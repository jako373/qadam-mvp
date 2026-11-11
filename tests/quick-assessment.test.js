import assert from "node:assert/strict";
import { test } from "node:test";
import { assessmentQuestions } from "../src/data/assessment-questions.js";
import { assessedSkillLevels } from "../src/lib/progress-engine.js";
import { renderCenterDashboard } from "../src/center-dashboard.js";
import { renderFamilyDashboard } from "../src/family-dashboard.js";

test("unknown skills remain unassessed, not level one", () => {
  const first = assessmentQuestions[0];
  const levels = assessedSkillLevels({ [first.id]: 2 }, assessmentQuestions);
  assert.equal(levels[first.category], 3);
  assert.equal(levels.understanding, null);
});

test("specialist starts with one question per skill and can choose all 16", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ scrollIntoView() {} }) };
  const child = { id: "child", name: "Ребёнок", age: 4 };
  const dataRequest = async (path) => path.startsWith("center_students?") ? [{ child_id: child.id }] : path.startsWith("children?") ? [child] : [];
  await renderCenterDashboard({ app, session: { access_token: "test", user: { id: "staff" } }, membership: { center_id: "center", role: "specialist", full_name: "Маман" }, dataRequest });
  await listeners.get("click")({ target: { closest: () => ({ dataset: { assess: child.id }, hasAttribute: (name) => name === "data-assess" }) } });
  assert.equal((app.innerHTML.match(/<fieldset>/g) || []).length, 8);
  assert.match(app.innerHTML, /data-assessment-mode="full"/);
});

test("family sees an unassessed skill instead of a false first level", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  const app = { innerHTML: "", querySelector: () => ({ addEventListener() {} }) };
  const dataRequest = async (path) => path.startsWith("children?") ? [{ id: "child", name: "Ребёнок", age: 4 }] : path.startsWith("specialist_assessments?") ? [{ specialist_name: "Маман", completed_at: "2026-11-11T12:00:00Z", skill_levels: { joint_attention: 3, understanding: null } }] : [];
  await renderFamilyDashboard({ app, session: { user: { id: "parent" } }, dataRequest });
  assert.match(app.innerHTML, /Не оценено/);
});
