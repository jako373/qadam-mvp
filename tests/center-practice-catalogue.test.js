import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eligibleCenterExercises } from '../src/lib/center-practice-catalogue.js';
const valid=[1,2,3].map(id=>({id:String(id),ageMin:2,ageMax:18,isActive:true}));
test('server catalogue enforces active and age eligibility without bundled fallback',()=>{
  assert.deepEqual(eligibleCenterExercises([...valid,{id:'too-young',ageMin:2,ageMax:7},{id:'inactive',ageMin:2,ageMax:18,isActive:false}],14,{},'2026-11-24'),valid);
  assert.throws(()=>eligibleCenterExercises([],5,{},'2026-11-24'));
  assert.throws(()=>eligibleCenterExercises(valid,20,{},'2026-11-24'));
  assert.throws(()=>eligibleCenterExercises(valid,5,{dailyPlans:{'2026-11-24':{items:[{exerciseId:'retired'}]}}},'2026-11-24'));
});
