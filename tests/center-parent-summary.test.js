import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderCenterDashboard } from '../src/center-dashboard.js';

test('specialist child plan shows independent activity separately from assigned homework', async () => {
  globalThis.localStorage = { getItem: () => 'ru', setItem() {} };
  globalThis.document = { documentElement: { lang: 'ru' } };
  const listeners = new Map(); const paths = [];
  const app = { innerHTML: '', addEventListener: (name, fn) => listeners.set(name, fn), querySelector: () => ({ scrollIntoView() {} }) };
  await renderCenterDashboard({ app, session: { user: { id: 'staff' } }, membership: { role: 'specialist', center_id: 'center' }, dataRequest: async (path, session, options) => {
    paths.push({ path, body: options?.body });
    if (path.startsWith('center_students?')) return [{ child_id: 'child' }];
    if (path.startsWith('children?')) return [{ id: 'child', name: 'Бала', age: 5 }];
    if (path === 'rpc/center_parent_practice_summary') return { attempt_count: 7, parent_assessment_at: '2026-11-24T10:00:00Z', recent_attempts: [{ exercise_id: 'communication-01', outcome: 'assisted', attempted_on: '2026-11-24' }] };
    return [];
  } });
  await listeners.get('click')({ target: { closest: () => ({ dataset: { plan: 'child' }, hasAttribute: name => name === 'data-plan' }) } });
  assert.match(app.innerHTML, /Самостоятельные занятия семьи/);
  assert.match(app.innerHTML, /Попыток: <strong>7/);
  assert.match(app.innerHTML, /2026-11-24/);
  assert.equal(paths.filter(p => p.path === 'rpc/center_parent_practice_summary').length, 1);
  assert.deepEqual(JSON.parse(paths.find(p => p.path === 'rpc/center_parent_practice_summary').body), { p_center_id: 'center', p_child_id: 'child' });
});
