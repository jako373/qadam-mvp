import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderCenterDashboard } from "../src/center-dashboard.js";

const migration = readFileSync(new URL("../supabase/migrations/20261106094114_individual_center_students.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/qadam-center-parent/index.ts", import.meta.url), "utf8");
const session = { access_token: "test", user: { id: "staff", email: "staff@example.test" } };
globalThis.localStorage = { getItem: () => "ru", setItem: () => {} };
globalThis.document = { documentElement: { lang: "ru" } };

function button(dataset, attribute) {
  const target = { dataset, hasAttribute: (name) => name === attribute, closest: () => target };
  return { target };
}

test("specialist can enroll an individual student without a group", async () => {
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, fn) => listeners.set(name, fn), querySelector: () => ({ focus() {}, scrollIntoView() {} }) };
  await renderCenterDashboard({ app, session, membership: { center_id: "center", role: "specialist" }, dataRequest: async () => [] });
  await listeners.get("click")(button({ view: "students" }, "data-view"));
  assert.match(app.innerHTML, /data-action="enroll"/);
  assert.match(app.innerHTML, /Индивидуально, без группы/);
  assert.doesNotMatch(app.innerHTML, /name="group_id" required/);
  assert.doesNotMatch(edge, /!groupId && actor\.center_role !== "admin"/);
  assert.match(edge, /center_specialist_students/);
});

test("specialist removes and restores only their individual assignment", async () => {
  const listeners = new Map();
  const assignment = { child_id: "child", specialist_id: "staff", child_name: "Алия", active: true };
  const writes = [];
  const app = { innerHTML: "", addEventListener: (name, fn) => listeners.set(name, fn), querySelector: () => ({ focus() {}, scrollIntoView() {} }) };
  const dataRequest = async (path, _session, options = {}) => {
    if (options.method === "PATCH") { writes.push(JSON.parse(options.body)); assignment.active = JSON.parse(options.body).active; return {}; }
    if (path.startsWith("center_specialist_students?")) return [assignment];
    if (path.startsWith("center_students?")) return assignment.active ? [{ child_id: "child" }] : [];
    if (path.startsWith("children?")) return [{ id: "child", name: "Алия", age: 8 }];
    return [];
  };
  const oldConfirm = globalThis.confirm;
  globalThis.confirm = () => true;
  try {
    await renderCenterDashboard({ app, session, membership: { center_id: "center", role: "specialist" }, dataRequest });
    await listeners.get("click")(button({ view: "students" }, "data-view"));
    assert.match(app.innerHTML, /data-remove-student="child"/);
    await listeners.get("click")(button({ removeStudent: "child" }, "data-remove-student"));
    assert.deepEqual(writes[0], { active: false });
    assert.match(app.innerHTML, /data-restore-student="child"/);
    await listeners.get("click")(button({ restoreStudent: "child" }, "data-restore-student"));
    assert.deepEqual(writes[1], { active: true });
    assert.match(app.innerHTML, /data-remove-student="child"/);
  } finally { globalThis.confirm = oldConfirm; }
});

test("calendar exposes rescheduling and lesson completion", async () => {
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, fn) => listeners.set(name, fn), querySelector: () => ({ focus() {}, scrollIntoView() {} }) };
  const item = { id: "lesson", child_id: "child", specialist_id: "staff", starts_at: new Date().toISOString(), duration_minutes: 45, topic: "Речь", status: "planned" };
  const dataRequest = async (path) => {
    if (path.startsWith("center_sessions?")) return [item];
    if (path.startsWith("center_students?")) return [{ child_id: "child" }];
    if (path.startsWith("children?")) return [{ id: "child", name: "Алия", age: 8 }];
    return [];
  };
  await renderCenterDashboard({ app, session, membership: { center_id: "center", role: "specialist" }, dataRequest });
  await listeners.get("click")(button({ view: "schedule" }, "data-view"));
  assert.match(app.innerHTML, /data-edit-session="lesson"/);
  assert.match(app.innerHTML, /data-complete-session="lesson"/);
  await listeners.get("click")(button({ completeSession: "lesson" }, "data-complete-session"));
  assert.match(app.innerHTML, /data-action="complete-session"/);
  await listeners.get("click")(button({ editSession: "lesson" }, "data-edit-session"));
  assert.match(app.innerHTML, /data-action="save-session"/);
  assert.match(app.innerHTML, /value="Речь"/);
});

test("assignment RLS and session updates retain ownership boundaries", () => {
  assert.match(migration, /center_specialist_students enable row level security/);
  assert.match(migration, /grant select, update\(active\)/);
  assert.match(migration, /individual\.active/);
  assert.match(migration, /grant update\(starts_at, duration_minutes, topic, status, session_summary, completed_at\)/);
  assert.doesNotMatch(migration, /delete from public\.children/i);
});

test("family password can be reissued only by center staff assigned to this child", () => {
  assert.match(edge, /async function reissuePassword\(req, body\)/);
  assert.match(edge, /actorFromRequest\(req, centerId\)/);
  assert.match(edge, /center_students\?select=child_id[^\n]*active=eq\.true/);
  assert.match(edge, /center_specialist_students\?select=child_id[^\n]*specialist_id=eq\.\$\{actor\.id\}[^\n]*active=eq\.true/);
  assert.match(edge, /child_login_accounts\?select=parent_id&child_id=eq\.\$\{childId\}/);
  assert.match(edge, /method: "PUT", body: JSON\.stringify\(\{ password \}\)/);
  assert.match(edge, /action === "reissue_password"/);
});

test("specialist sees a reset button and gets a new temporary password once", async () => {
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, fn) => listeners.set(name, fn), querySelector: () => ({ focus() {}, scrollIntoView() {} }) };
  const dataRequest = async (path) => {
    if (path.startsWith("center_students?")) return [{ child_id: "child" }];
    if (path.startsWith("center_specialist_students?")) return [{ child_id: "child", specialist_id: "staff", child_name: "Алия", active: true }];
    if (path.startsWith("children?")) return [{ id: "child", name: "Алия", age: 8 }];
    return [];
  };
  const calls = [];
  const oldConfirm = globalThis.confirm;
  globalThis.confirm = () => true;
  try {
    await renderCenterDashboard({ app, session, membership: { center_id: "center", role: "specialist" }, dataRequest, apiRequest: async (path, options) => { calls.push({ path, body: JSON.parse(options.body) }); return { temporary_password: "one-time-secret" }; } });
    await listeners.get("click")(button({ view: "students" }, "data-view"));
    assert.match(app.innerHTML, /data-reissue-password="child"/);
    const action = button({ reissuePassword: "child" }, "data-reissue-password");
    await listeners.get("click")(action);
    assert.equal(calls[0].body.action, "reissue_password");
    assert.equal(calls[0].body.child_id, "child");
    assert.match(app.innerHTML, /one-time-secret/);
    assert.doesNotMatch(app.innerHTML, /undefined/);
  } finally { globalThis.confirm = oldConfirm; }
});
