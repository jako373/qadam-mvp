import { createDefaultState } from '../storage.js';
import { normalizeAdaptiveState } from './adaptive-state.js';
import { canonicalExerciseHistory, exerciseProgressFromHistory } from './progress-engine.js';

const categories = ['joint_attention', 'understanding', 'imitation', 'communication', 'play_thinking', 'fine_motor', 'regulation', 'daily_social'];
const fingerprint = state => JSON.stringify({ assessment: state.adaptive.initialAssessment.completedAt,
  plans: Object.entries(state.adaptive.dailyPlans).sort(([a], [b]) => a.localeCompare(b)).map(([day, plan]) => [day, plan.items, plan.results, plan.viewedCount, plan.completedAt]) });

// This boundary never creates children or writes specialist/homework records.
export function createCenterParentPractice({ request, storage, getSession }) {
  let owner, childId, base, remoteState;
  let knownAttempts = new Set();
  let knownAssessment = null;
  const key = () => `qadam.center.practice.pending.${owner}.${childId}`;
  async function currentSession() {
    const session = await getSession();
    if (!owner || session?.user?.id !== owner) throw new Error('Аккаунт изменился. Войдите снова / Аккаунт өзгерді. Қайта кіріңіз.');
    return session;
  }
  async function upsert(table, rows, conflict, session) {
    if (!rows.length) return;
    await currentSession();
    const resolution = ['skill_assessments', 'exercise_attempts'].includes(table) ? 'ignore-duplicates' : 'merge-duplicates';
    await request(`${table}?on_conflict=${encodeURIComponent(conflict)}`, session, { method: 'POST', headers: { Prefer: `resolution=${resolution},return=minimal` }, body: JSON.stringify(rows) });
  }
  async function stableId(kind, value) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${owner}:${childId}:${kind}:${value}`))).slice(0, 16);
    bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  return {
    async hydrate(session, language) {
      owner = session.user.id;
      const children = await request(`children?select=*&parent_id=eq.${encodeURIComponent(owner)}&order=created_at.asc&limit=2`, session);
      if (children.length !== 1 || children[0].parent_id !== owner) throw new Error('Не удалось однозначно определить ребёнка. Обратитесь в центр / Бала профилін орталықтан нақтылаңыз.');
      const child = children[0]; childId = child.id;
      const query = `child_id=eq.${encodeURIComponent(childId)}`;
      const [assessments, levels, progress, plans, attempts] = await Promise.all([
        request(`skill_assessments?select=*&${query}&order=completed_at.desc&limit=20`, session),
        request(`child_skill_levels?select=*&${query}`, session),
        request(`child_exercise_progress?select=*&${query}`, session),
        request(`daily_plans?select=*&${query}&order=plan_date.asc`, session),
        request(`exercise_attempts?select=*&${query}&order=created_at.asc&limit=1000`, session),
      ]);
      await currentSession();
      const state = createDefaultState(); state.language = language === 'ru' ? 'ru' : 'kk';
      state.progress.onboardingCompleted = true;
      state.childProfile = { name: child.name, age: child.age, diagnosis: child.diagnosis || '', homeLanguage: child.home_language || '', meaningfulWords: child.meaningful_words || '', interests: child.interests || '', dislikes: child.dislikes || '', bestTime: child.best_time || '' };
      const initial = assessments.find(item => item.assessment_type === 'initial');
      knownAssessment = initial?.completed_at || null;
      const history = canonicalExerciseHistory(plans, attempts);
      const ids = [...new Set([...progress.map(item => item.exercise_id), ...history.map(item => item.exerciseId)])];
      state.adaptive = normalizeAdaptiveState({
        initialAssessment: { answers: initial?.answers || {}, completedAt: initial?.completed_at || null },
        skillLevels: Object.fromEntries(categories.map(category => [category, levels.find(item => item.category === category)?.level || initial?.skill_levels?.[category] || 1])),
        exerciseHistory: history, exerciseProgress: exerciseProgressFromHistory(history, ids), introducedExerciseIds: ids,
        favoriteExerciseIds: progress.filter(item => item.is_favorite).map(item => item.exercise_id),
        dailyPlans: Object.fromEntries(plans.map(item => [item.plan_date, { date: item.plan_date, basedOnDate: item.based_on_date, items: item.items, results: item.results || {}, viewedCount: item.viewed_count, completedAt: item.completed_at }])),
        completedDates: plans.filter(item => item.completed_at).map(item => item.plan_date),
      });
      knownAttempts = new Set(attempts.map(item => item.created_at));
      base = fingerprint(state); remoteState = state;
      const pending = JSON.parse(storage.getItem(key()) || 'null');
      if (pending) {
        if (pending.base !== base) throw new Error('Есть несохранённый черновик, а данные на сервере изменились. Повторите сохранение явно или обратитесь в поддержку / Сақталмаған өзгерістер бар.');
        return pending.state;
      }
      return state;
    },
    hasPending() { return Boolean(owner && childId && storage.getItem(key())); },
    stage(state) {
      if (!owner || !childId || !remoteState) throw new Error('Сначала загрузите профиль ребёнка');
      storage.setItem(key(), JSON.stringify({ base, state: JSON.parse(JSON.stringify(state)) }));
    },
    async retryPending() {
      await currentSession();
      const pending = JSON.parse(storage.getItem(key()) || 'null');
      if (!pending) return remoteState;
      await this.save(pending.state);
      return pending.state;
    },
    async save(state) {
      const session = await currentSession();
      if (!childId || !remoteState) throw new Error('Сначала загрузите профиль ребёнка');
      const snapshot = JSON.parse(JSON.stringify(state));
      if (!storage.getItem(key())) storage.setItem(key(), JSON.stringify({ base, state: snapshot }));
      const a = normalizeAdaptiveState(snapshot.adaptive);
      const identity = { parent_id: owner, child_id: childId };
      const assessment = a.initialAssessment;
      if (assessment.completedAt && assessment.completedAt !== knownAssessment) await upsert('skill_assessments', [{ ...identity, id: await stableId('assessment', assessment.completedAt), assessment_type: 'initial', answers: assessment.answers, skill_levels: a.skillLevels, completed_at: assessment.completedAt }], 'id', session);
      await upsert('child_skill_levels', categories.map(category => ({ ...identity, category, level: a.skillLevels[category] })), 'child_id,category', session);
      const favorites = new Set(a.favoriteExerciseIds);
      await upsert('child_exercise_progress', [...new Set([...Object.keys(a.exerciseProgress), ...favorites])].map(exercise_id => { const item = a.exerciseProgress[exercise_id] || {}; return { ...identity, exercise_id, independent_count: item.independentCount || 0, unable_streak: item.unableStreak || 0, attempts: item.attempts || 0, last_outcome: item.lastOutcome || null, last_attempted_on: item.lastDate || null, is_favorite: favorites.has(exercise_id) }; }), 'child_id,exercise_id', session);
      await upsert('daily_plans', Object.entries(a.dailyPlans).filter(([, plan]) => plan.items.length === 3).map(([plan_date, plan]) => ({ ...identity, plan_date, based_on_date: plan.basedOnDate, items: plan.items, results: plan.results, viewed_count: plan.viewedCount, completed_at: plan.completedAt })), 'child_id,plan_date', session);
      const newAttempts = a.exerciseHistory.filter(item => !knownAttempts.has(item.at));
      await upsert('exercise_attempts', await Promise.all(newAttempts.map(async item => ({ ...identity, id: await stableId('attempt', `${item.exerciseId}:${item.at}`), exercise_id: item.exerciseId, category: item.category, exercise_level: item.level, outcome: item.outcome, score: item.score, attempted_on: item.date, created_at: item.at }))), 'id', session);
      await currentSession();
      knownAttempts = new Set([...knownAttempts, ...newAttempts.map(item => item.at)]);
      knownAssessment = assessment.completedAt; base = fingerprint(snapshot); remoteState = snapshot;
      const pending = JSON.parse(storage.getItem(key()) || 'null');
      if (pending && JSON.stringify(pending.state) !== JSON.stringify(snapshot)) storage.setItem(key(), JSON.stringify({ ...pending, base }));
      else storage.removeItem(key());
    },
  };
}
