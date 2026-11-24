import { createDefaultState } from '../storage.js';
import { normalizeAdaptiveState } from './adaptive-state.js';
import { canonicalExerciseHistory, exerciseProgressFromHistory } from './progress-engine.js';

const categories = ['joint_attention','understanding','imitation','communication','play_thinking','fine_motor','regulation','daily_social'];
const eventKey = item => item.exerciseId + ':' + new Date(item.at).toISOString();
const persisted = a => JSON.stringify([a.initialAssessment,a.completedReassessment,a.skillLevels,a.exerciseProgress,a.favoriteExerciseIds,a.dailyPlans]);

// A single owner-checked server transaction saves existing parent tables.
export function createCenterParentPractice({ request, storage, getSession }) {
  let owner, childId, revision, remoteState, knownInitial, knownReassessment, savedFingerprint;
  let knownEvents = new Set();
  const key = () => 'qadam.center.practice.pending.' + owner + '.' + childId;
  async function currentSession() {
    const session = await getSession();
    if (!owner || session?.user?.id !== owner) throw new Error('Аккаунт изменился. Войдите снова / Аккаунт өзгерді. Қайта кіріңіз.');
    return session;
  }
  async function stableId(kind, value) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner + ':' + childId + ':' + kind + ':' + value))).slice(0,16);
    bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }
  return {
    async hydrate(session, language) {
      owner=session.user.id;
      const children=await request('children?select=*&parent_id=eq.'+encodeURIComponent(owner)+'&order=created_at.asc&limit=2',session);
      if(children.length!==1 || children[0].parent_id!==owner)throw new Error('Уточните профиль ребёнка в центре / Бала профилін орталықтан нақтылаңыз.');
      childId=children[0].id;
      const data=await request('rpc/center_parent_practice_state',session,{method:'POST',body:JSON.stringify({p_child_id:childId})});
      await currentSession();
      const child=data.child;
      if(child?.id!==childId || child.parent_id!==owner || typeof data.revision!=='string')throw new Error('Неверный профиль или версия данных / Профиль жүктелмеді');
      const {assessments,levels,progress,plans,attempts}=data;
      if(![assessments,levels,progress,plans,attempts].every(Array.isArray))throw new Error('Неполные данные / Деректер толық емес');
      const state=createDefaultState();state.language=language==='ru'?'ru':'kk';state.progress.onboardingCompleted=true;
      state.childProfile={name:child.name,age:child.age,diagnosis:child.diagnosis||'',homeLanguage:child.home_language||'',meaningfulWords:child.meaningful_words||'',interests:child.interests||'',dislikes:child.dislikes||'',bestTime:child.best_time||''};
      const initial=assessments.find(item=>item.assessment_type==='initial');
      const recheck=assessments.find(item=>item.assessment_type==='reassessment');
      knownInitial=initial?.completed_at||null;knownReassessment=recheck?.completed_at||null;
      const history=canonicalExerciseHistory(plans,attempts);
      knownEvents=new Set(history.map(eventKey));
      const ids=[...new Set([...progress.map(item=>item.exercise_id),...history.map(item=>item.exerciseId)])];
      const counters=exerciseProgressFromHistory(history,ids);
      // Stored counters are lifetime aggregates; history is only a display window.
      for(const item of progress)counters[item.exercise_id]={attempts:item.attempts,independentCount:item.independent_count,unableStreak:item.unable_streak,lastOutcome:item.last_outcome,lastDate:item.last_attempted_on};
      state.adaptive=normalizeAdaptiveState({initialAssessment:{answers:initial?.answers||{},completedAt:knownInitial},
        completedReassessment:recheck?{answers:recheck.answers,completedAt:knownReassessment}:null,lastReassessmentAt:knownReassessment,
        skillLevels:Object.fromEntries(categories.map(category=>[category,levels.find(item=>item.category===category)?.level||initial?.skill_levels?.[category]||1])),
        exerciseHistory:history,exerciseProgress:counters,introducedExerciseIds:ids,favoriteExerciseIds:progress.filter(item=>item.is_favorite).map(item=>item.exercise_id),
        dailyPlans:Object.fromEntries(plans.map(item=>[item.plan_date,{date:item.plan_date,basedOnDate:item.based_on_date,items:item.items,results:item.results||{},viewedCount:item.viewed_count,completedAt:item.completed_at}])),
        completedDates:plans.filter(item=>item.completed_at).map(item=>item.plan_date)});
      revision=data.revision;remoteState=state;savedFingerprint=persisted(state.adaptive);
      const pending=JSON.parse(storage.getItem(key())||'null');
      if(pending){if(pending.revision!==revision)throw new Error('Данные изменились на другом устройстве. Черновик сохранён отдельно / Басқа құрылғыдағы деректер өзгерді.');return pending.state;}
      return state;
    },
    hasPending(){return Boolean(owner&&childId&&storage.getItem(key()));},
    stage(state){if(!remoteState)throw new Error('Сначала загрузите профиль');storage.setItem(key(),JSON.stringify({revision,state:JSON.parse(JSON.stringify(state))}));},
    async useServerVersion(){await currentSession();const draft=storage.getItem(key());if(draft){storage.setItem(key()+'.conflict.'+Date.now(),draft);storage.removeItem(key());}return remoteState;},
    async retryPending(){await currentSession();const pending=JSON.parse(storage.getItem(key())||'null');if(!pending)return remoteState;await this.save(pending.state);return pending.state;},
    async save(state){
      const session=await currentSession();if(!remoteState)throw new Error('Сначала загрузите профиль');
      const snapshot=JSON.parse(JSON.stringify(state));if(!storage.getItem(key()))this.stage(snapshot);
      const pending=JSON.parse(storage.getItem(key()));
      const a=normalizeAdaptiveState(snapshot.adaptive);if(!a.initialAssessment.completedAt)return;
      if(persisted(a)===savedFingerprint){if(!a.reassessment.startedAt&&JSON.stringify(pending.state)===JSON.stringify(snapshot))storage.removeItem(key());return;}
      const identity={parent_id:owner,child_id:childId};const records={skill_assessments:[],child_skill_levels:[],child_exercise_progress:[],daily_plans:[],exercise_attempts:[]};
      for(const [kind,value,known] of [['initial',a.initialAssessment,knownInitial],['reassessment',a.completedReassessment,knownReassessment]]){
        if(value?.completedAt&&value.completedAt!==known)records.skill_assessments.push({...identity,id:await stableId(kind,value.completedAt),assessment_type:kind,answers:value.answers,skill_levels:a.skillLevels,completed_at:value.completedAt});
      }
      records.child_skill_levels=categories.map(category=>({...identity,category,level:a.skillLevels[category]}));
      const favorites=new Set(a.favoriteExerciseIds);
      records.child_exercise_progress=[...new Set([...Object.keys(a.exerciseProgress),...favorites])].map(exercise_id=>{const item=a.exerciseProgress[exercise_id]||{};return {...identity,exercise_id,independent_count:item.independentCount||0,unable_streak:item.unableStreak||0,attempts:item.attempts||0,last_outcome:item.lastOutcome||null,last_attempted_on:item.lastDate||null,is_favorite:favorites.has(exercise_id)};});
      records.daily_plans=Object.entries(a.dailyPlans).filter(([,plan])=>plan.items.length===3).map(([plan_date,plan])=>({...identity,plan_date,based_on_date:plan.basedOnDate,items:plan.items,results:plan.results,viewed_count:plan.viewedCount,completed_at:plan.completedAt}));
      const events=a.exerciseHistory.filter(item=>!knownEvents.has(eventKey(item)));
      records.exercise_attempts=await Promise.all(events.map(async item=>({...identity,id:await stableId('attempt',eventKey(item)),exercise_id:item.exerciseId,category:item.category,exercise_level:item.level,outcome:item.outcome,score:item.score,attempted_on:item.date,created_at:item.at})));
      await currentSession();
      const saved=await request('rpc/center_save_parent_practice',session,{method:'POST',body:JSON.stringify({p_child_id:childId,p_expected_revision:pending.revision,p_records:records})});
      await currentSession();if(typeof saved?.revision!=='string')throw new Error('Сервер не подтвердил сохранение');
      revision=saved.revision;remoteState=snapshot;savedFingerprint=persisted(a);knownInitial=a.initialAssessment.completedAt;knownReassessment=a.completedReassessment?.completedAt||null;
      for(const event of events)knownEvents.add(eventKey(event));
      const latest=JSON.parse(storage.getItem(key())||'null');
      if(latest&&(JSON.stringify(latest.state)!==JSON.stringify(snapshot)||a.reassessment.startedAt))storage.setItem(key(),JSON.stringify({...latest,revision}));
      else storage.removeItem(key());
    },
  };
}
