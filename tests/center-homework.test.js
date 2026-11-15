import assert from "node:assert/strict";
import { test } from "node:test";
import { homeworkStatus } from "../src/lib/center-homework.js";
import { renderCenterDashboard } from "../src/center-dashboard.js";
import { renderFamilyDashboard } from "../src/family-dashboard.js";

test("homework status distinguishes no response, partial, unable and complete", () => {
  assert.equal(homeworkStatus(["a", "b"], {}), "pending");
  assert.equal(homeworkStatus(["a", "b"], { a: "done" }), "partial");
  assert.equal(homeworkStatus(["a", "b"], { a: "unable", b: "unable" }), "unable");
  assert.equal(homeworkStatus(["a", "b"], { a: "done", b: "difficult" }), "partial");
  assert.equal(homeworkStatus(["a", "b"], { a: "done", b: "done" }), "complete");
});

test("specialist can open a child's homework composer without another child's data", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ scrollIntoView() {} }) };
  const dataRequest = async (path) => path.startsWith("center_students?") ? [{ child_id: "mine" }] : path.startsWith("children?") ? [{ id: "mine", name: "Мой ребёнок", age: 4 }] : [];
  await renderCenterDashboard({ app, session: { user: { id: "staff" } }, membership: { center_id: "center", role: "specialist", full_name: "Маман" }, dataRequest });
  assert.match(app.innerHTML, /data-homework="mine"/);
  await listeners.get("click")({ target: { closest: () => ({ dataset: { homework: "mine" }, hasAttribute: (name) => name === "data-homework" }) } });
  assert.match(app.innerHTML, /data-action="assign-homework"/);
  assert.doesNotMatch(app.innerHTML, /чужой ребёнок/);
});

test("parent sees assigned homework before progress and can report each exercise", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  const app = { innerHTML: "", querySelector: () => ({ addEventListener() {} }), addEventListener() {} };
  const dataRequest = async (path) => path.startsWith("children?") ? [{ id: "child", name: "Ребёнок", age: 4 }] : path.startsWith("center_homework?") ? [{ id: "task", exercise_ids: ["joint_attention-01"], responses: {}, assigned_at: "2026-11-11T10:00:00Z" }] : [];
  await renderFamilyDashboard({ app, session: { user: { id: "parent" } }, dataRequest });
  assert.ok(app.innerHTML.indexOf("Задания специалиста") < app.innerHTML.indexOf("family-progress-card"));
  assert.match(app.innerHTML, /data-homework-response="done"/);
  assert.match(app.innerHTML, /data-homework-response="difficult"/);
  assert.match(app.innerHTML, /data-homework-response="unable"/);
});

test("parent sees own center tuition and attendance without internal finance notes", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  const app = { innerHTML: "", querySelector: () => ({ addEventListener() {} }), addEventListener() {} };
  const dataRequest = async (path) => path.startsWith("children?") ? [{ id: "child", name: "Ребёнок", age: 4, birth_date: null }]
    : path.startsWith("center_students?") ? [{ center_id: "center" }]
    : path === "rpc/center_tuition_overview" ? [{ id: "charge", description: "Занятия", period_start: "2026-11-01", period_end: "2026-11-30", charged: 10000, paid: 4000, due: 6000, status: "partial" }]
    : path.startsWith("center_sessions?") ? [{ starts_at: "2026-11-15T10:00:00Z", status: "present", topic: "Урок", duration_minutes: 45 }] : [];
  await renderFamilyDashboard({ app, session: { user: { id: "parent" } }, dataRequest });
  assert.match(app.innerHTML, /Частично оплачено/);
  assert.match(app.innerHTML, /6[\s\u00a0]?000/);
  assert.match(app.innerHTML, /Посещено занятий/);
  assert.doesNotMatch(app.innerHTML, /internal_note/);
});
