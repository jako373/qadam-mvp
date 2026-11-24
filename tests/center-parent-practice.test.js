import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCenterParentPractice } from '../src/lib/center-parent-practice.js';

function setup() {
  let session = { user: { id: 'parent' }, access_token: 'test' };
  let onWrite = null;
  const values = new Map(); const writes = [];
  const child = { id: 'child', parent_id: 'parent', name: 'Бала', age: 5 };
  const rows = { children: [child], skill_assessments: [], child_skill_levels: [], child_exercise_progress: [], daily_plans: [], exercise_attempts: [] };
  const request = async (path, auth, options) => {
    if (options?.method === 'POST') { if (onWrite) await onWrite(); writes.push({ path, uid: auth.user.id, rows: JSON.parse(options.body), prefer: options.headers.Prefer }); return []; }
    return rows[path.split('?')[0]] || [];
  };
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  return { store: createCenterParentPractice({ request, storage, getSession: async () => session }), rows, values, writes, onWrite: fn => { onWrite = fn; }, switchUser: () => { session = { user: { id: 'other' } }; }, session };
}

test('center parent hydration ignores stale browser state and retains server child', async () => {
  const f = setup(); f.values.set('qadam.mvp.state.v1', JSON.stringify({ childProfile: { name: 'Чужой' }, adaptive: { initialAssessment: { completedAt: '2020-01-01' } } }));
  const state = await f.store.hydrate(f.session, 'kk');
  assert.equal(state.childProfile.name, 'Бала'); assert.equal(state.adaptive.initialAssessment.completedAt, null);
});

test('failed writes retain the current child draft for explicit retry', async () => {
  const f = setup(); const state = await f.store.hydrate(f.session, 'ru');
  f.onWrite(() => { throw new Error('offline'); });
  await assert.rejects(f.store.save(state), /offline/);
  assert.equal(f.store.hasPending(), true);
  f.onWrite(null); await f.store.retryPending(); assert.equal(f.store.hasPending(), false);
});

test('an older in-flight save cannot delete a newer staged answer', async () => {
  const f = setup(); const state = await f.store.hydrate(f.session, 'ru');
  let first = true;
  const newer = structuredClone(state); newer.adaptive.initialAssessment.answers = { a: 2 };
  f.onWrite(() => { if (first) { first = false; f.store.stage(newer); } });
  await f.store.save(state);
  assert.equal(f.store.hasPending(), true);
  const draft = JSON.parse([...f.values.values()][0]);
  assert.equal(draft.state.adaptive.initialAssessment.answers.a, 2);
});

test('wrong parent or failed server hydration never falls back to cache', async () => {
  const f = setup(); f.rows.children[0].parent_id = 'other';
  await assert.rejects(f.store.hydrate(f.session, 'ru'));
});

test('center practice saves to linked child without upserting its profile or homework', async () => {
  const f = setup(); const state = await f.store.hydrate(f.session, 'ru');
  state.adaptive.initialAssessment = { answers: {}, completedAt: '2026-11-24T10:00:00Z' };
  await f.store.save(state);
  assert.ok(f.writes.some(w => w.path.startsWith('skill_assessments')));
  assert.match(f.writes.find(w => w.path.startsWith('skill_assessments')).prefer, /ignore-duplicates/);
  assert.ok(f.writes.every(w => !/^(children|center_homework|specialist_assessments)/.test(w.path)));
  assert.ok(f.writes.flatMap(w => w.rows).every(row => row.child_id === 'child' && row.parent_id === 'parent'));
});

test('pending save cannot write under a different account', async () => {
  const f = setup(); const state = await f.store.hydrate(f.session, 'ru'); f.switchUser();
  await assert.rejects(f.store.save(state)); assert.equal(f.writes.length, 0);
});

test('an existing parent assessment is restored from server on another device', async () => {
  const f = setup(); f.rows.skill_assessments = [{ assessment_type: 'initial', answers: { a: 2 }, completed_at: '2026-11-24T10:00:00Z' }];
  f.rows.daily_plans = [{ plan_date: '2026-11-24', items: [], results: {}, viewed_count: 1 }];
  const state = await f.store.hydrate(f.session, 'ru');
  assert.equal(state.adaptive.initialAssessment.completedAt, '2026-11-24T10:00:00Z');
  assert.equal(state.adaptive.dailyPlans['2026-11-24'].viewedCount, 1);
});
