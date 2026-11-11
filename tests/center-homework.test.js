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
