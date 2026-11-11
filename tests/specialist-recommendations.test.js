import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendHomework } from "../src/lib/center-homework.js";
import { renderCenterDashboard } from "../src/center-dashboard.js";
import { exercises } from "../src/data/exercises.js";

const catalogue = [
  { id: "imitation-01", category: "imitation", level: 1, isActive: true },
  { id: "imitation-02", category: "imitation", level: 1, isActive: true },
  { id: "imitation-03", category: "imitation", level: 2, isActive: true },
  { id: "communication-01", category: "communication", level: 1, isActive: true },
  { id: "communication-02", category: "communication", level: 2, isActive: true },
  { id: "play_thinking-01", category: "play_thinking", level: 1, isActive: false },
];

test("recommendations omit unassessed and mastered skills and only suggest active matching levels", () => {
  const result = recommendHomework({ imitation: 1, communication: 2, play_thinking: null, fine_motor: 3 }, catalogue);
  assert.deepEqual(result.priorities.map((item) => [item.category, item.level]), [["imitation", 1], ["communication", 2]]);
  assert.deepEqual(result.exerciseIds, ["imitation-01", "imitation-02", "communication-02"]);
  assert.deepEqual(result.unassessed, ["play_thinking"]);
});

test("too little assessment yields no confident exercise recommendation", () => {
  const result = recommendHomework({ imitation: 1, communication: null }, catalogue);
  assert.equal(result.insufficient, true);
  assert.deepEqual(result.exerciseIds, []);
});

test("next tasks retry difficulty and advance only successful exercise", () => {
  const homework = { exercise_ids: ["imitation-01", "communication-01"], responses: { "imitation-01": { result: "difficult" }, "communication-01": { result: "done" } } };
  const result = recommendHomework({ imitation: 1, communication: 1 }, catalogue, homework);
  assert.deepEqual(result.exerciseIds, ["imitation-01", "communication-02"]);
});

test("specialist sees latest homework status and explicit recommendations for the selected child", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ scrollIntoView() {} }) };
  const catalogueRows = exercises.filter((item) => ["imitation-01", "imitation-02", "communication-01", "communication-02"].includes(item.id)).map((content) => ({ content }));
  const dataRequest = async (path) => path.startsWith("center_students?") ? [{ child_id: "child" }] : path.startsWith("children?") ? [{ id: "child", name: "Ребёнок", age: 4 }] : path.startsWith("specialist_assessments?") ? [{ child_id: "child", skill_levels: { imitation: 1, communication: 2 }, completed_at: "2026-11-11T09:00:00Z" }] : path.startsWith("center_homework?") ? [{ id: "prior", child_id: "child", specialist_id: "staff", exercise_ids: ["imitation-01"], responses: {}, assigned_at: "2026-11-11T09:00:00Z" }] : path === "rpc/active_exercises" ? catalogueRows : [];
  await renderCenterDashboard({ app, session: { user: { id: "staff" } }, membership: { center_id: "center", role: "specialist", full_name: "Маман" }, dataRequest });
  assert.match(app.innerHTML, /Последнее задание: Нет ответа/);
  await listeners.get("click")({ target: { closest: () => ({ dataset: { recommend: "child" }, hasAttribute: (name) => name === "data-recommend" }) } });
  assert.match(app.innerHTML, /QADAM рекомендует/);
  assert.match(app.innerHTML, /value="imitation-01" checked/);
});
