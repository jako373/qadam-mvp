import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderCenterDashboard } from "../src/center-dashboard.js";
import { renderFamilyDashboard } from "../src/family-dashboard.js";

const migration = readFileSync(new URL("../supabase/migrations/20261106091131_specialist_planning.sql", import.meta.url), "utf8");
const session = { access_token: "test", user: { id: "staff", email: "staff@example.test" } };
globalThis.localStorage = { getItem: () => "ru", setItem: () => {} };
globalThis.document = { documentElement: { lang: "ru" } };

test("specialist calendar renders by section button with a helpful empty state", async () => {
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ focus() {} }) };
  const dataRequest = async (path) => {
    if (path.startsWith("center_staff?")) return [{ user_id: "staff", role: "specialist", full_name: "Маман" }];
    return [];
  };
  await renderCenterDashboard({ app, session, membership: { center_id: "center", role: "specialist", full_name: "Маман", center_name: "Qadam" }, dataRequest });
  assert.match(app.innerHTML, /data-view="schedule"/);
  await listeners.get("click")({ target: { closest: () => ({ dataset: { view: "schedule" }, hasAttribute: (name) => name === "data-view" }) } });
  assert.match(app.innerHTML, /Календарь занятий/);
  assert.match(app.innerHTML, /На этот день занятий нет/);
  assert.match(app.innerHTML, /data-week="7"/);
});

test("specialist can mark attendance for a scheduled child", async () => {
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ focus() {} }) };
  const item = { id: "session-1", child_id: "child-1", specialist_id: "staff", starts_at: new Date().toISOString(), duration_minutes: 45, topic: "Речь", status: "planned" };
  const writes = [];
  const dataRequest = async (path, _session, options = {}) => {
    if (options.method === "PATCH") { writes.push({ path, body: JSON.parse(options.body) }); item.status = "present"; return {}; }
    if (path.startsWith("center_students?")) return [{ child_id: "child-1", active: true }];
    if (path.startsWith("children?")) return [{ id: "child-1", name: "Алия", age: 8, diagnosis: "ЗРР" }];
    if (path.startsWith("center_sessions?")) return [item];
    return [];
  };
  await renderCenterDashboard({ app, session, membership: { center_id: "center", role: "specialist", full_name: "Маман" }, dataRequest });
  await listeners.get("click")({ target: { closest: () => ({ dataset: { view: "schedule" }, hasAttribute: (name) => name === "data-view" }) } });
  assert.match(app.innerHTML, /Речь/);
  const target = { dataset: { sessionId: "session-1", sessionStatus: "present" }, hasAttribute: (name) => name === "data-session-id", closest: (selector) => selector === ".center-attendance" ? { querySelectorAll: () => [] } : target };
  await listeners.get("click")({ target });
  assert.deepEqual(writes, [{ path: "center_sessions?id=eq.session-1&center_id=eq.center", body: { status: "present" } }]);
  assert.match(app.innerHTML, /Посещение отмечено/);
});

test("family dashboard requests only family-visible recommendations and shows skill goals", async () => {
  const paths = [];
  const app = { innerHTML: "", querySelector: () => ({ addEventListener() {} }) };
  const dataRequest = async (path) => {
    paths.push(path);
    if (path.startsWith("children?")) return [{ id: "child", name: "Алия", age: 8 }];
    if (path.startsWith("center_skill_goals?")) return [{ skill_key: "communication", summary: "Просить о помощи словами", target_level: 2, status: "active" }];
    if (path.startsWith("center_child_notes?")) return [{ content: "Попробуйте игру с выбором", created_at: "2026-11-06T10:00:00Z" }];
    return [];
  };
  await renderFamilyDashboard({ app, session: { ...session, user: { id: "parent" } }, dataRequest });
  assert.ok(paths.some((path) => path.includes("center_child_notes?") && path.includes("audience=eq.family")));
  assert.match(app.innerHTML, /Попробуйте игру с выбором/);
  assert.match(app.innerHTML, /Просить о помощи словами/);
  assert.match(app.innerHTML, /Занятий пока нет/);
});

test("database policies separate team notes from family recommendations", () => {
  assert.match(migration, /alter table public\.center_child_notes enable row level security/);
  assert.match(migration, /audience = 'family' and exists/);
  assert.match(migration, /author_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.center_can_view_child\(center_id, child_id\)/);
  assert.match(migration, /center_sessions_update[\s\S]*?with check/);
  assert.match(migration, /center_skill_goals_update[\s\S]*?with check/);
});
