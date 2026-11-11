import assert from "node:assert/strict";
import { test } from "node:test";
import { filterCuratedExercises, readExerciseCuration, updateExerciseCuration } from "../src/lib/exercise-curation.js";
import { renderCenterDashboard } from "../src/center-dashboard.js";
import { exercises } from "../src/data/exercises.js";

const items = [
  { id: "a", category: "imitation", level: 1, ageMin: 2, ageMax: 5, specialties: ["speech"], difficulty: "intro", isActive: true },
  { id: "b", category: "imitation", level: 2, ageMin: 6, ageMax: 12, specialties: ["development"], difficulty: "standard", isActive: true },
  { id: "c", category: "imitation", level: 1, isActive: true },
  { id: "d", category: "imitation", level: 1, ageMin: 2, ageMax: 5, specialties: ["speech"], difficulty: "intro", isActive: false },
];

test("all imported exercises have provisional age, difficulty and suitable practice directions", () => {
  assert.equal(exercises.length, 120);
  for (const item of exercises) {
    assert.equal(item.ageMin, item.level + 1, item.id);
    assert.equal(item.ageMax, 18, item.id);
    assert.equal(item.difficulty, ["intro", "standard", "advanced"][item.level - 1], item.id);
    assert.ok(item.specialties.length > 0, item.id);
    assert.equal(item.specialties.includes("biofeedback"), false, item.id);
  }
  assert.deepEqual(exercises.find((item) => item.id === "imitation-07").specialties, ["development", "speech"]);
  assert.deepEqual(exercises.find((item) => item.id === "imitation-01").specialties, ["development"]);
  assert.deepEqual(exercises.find((item) => item.id === "regulation-01").specialties, ["general"]);
});

test("age, specialty and difficulty filters exclude unreviewed and inactive exercises", () => {
  assert.deepEqual(filterCuratedExercises(items, { age: "5", specialty: "speech", difficulty: "intro" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterCuratedExercises(items, { age: "6" }).map((item) => item.id), ["b"]);
  assert.deepEqual(filterCuratedExercises(items, {}).map((item) => item.id), ["a", "b", "c"]);
});

test("curation requires a bounded age range and recognized specialty", () => {
  const data = new FormData();
  data.set("age_min", "2"); data.set("age_max", "5"); data.set("difficulty", "intro"); data.append("specialty", "speech");
  assert.deepEqual(readExerciseCuration(data), { ageMin: 2, ageMax: 5, specialties: ["speech"], difficulty: "intro" });
  data.set("age_max", "1");
  assert.throws(() => readExerciseCuration(data), /age|возраст/i);
  data.set("age_max", "5"); data.append("specialty", "unapproved");
  assert.throws(() => readExerciseCuration(data), /special|специаль/i);
});

test("clearing review fields removes stale suitability tags without changing exercise text", () => {
  const content = { id: "imitation-01", ageMin: 2, ageMax: 5, specialties: ["speech"], difficulty: "intro", ru: { title: "Игра" } };
  const updated = updateExerciseCuration(content, new FormData());
  assert.deepEqual(updated, { id: "imitation-01", ru: { title: "Игра" } });
  assert.equal(content.ageMin, 2);
});

test("specialist library offers curation filters without silently hiding unreviewed exercises", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (type, listener) => listeners.set(type, listener), querySelector: () => ({ focus() {} }) };
  const dataRequest = async (path) => path === "rpc/active_exercises" ? items.map((content) => ({ content })) : [];
  await renderCenterDashboard({ app, session: { user: { id: "staff" } }, membership: { center_id: "center", role: "specialist", full_name: "Маман" }, dataRequest });
  await listeners.get("click")({ target: { closest: () => ({ dataset: { view: "exercises" }, hasAttribute: (name) => name === "data-view" }) } });
  assert.match(app.innerHTML, /name="library_age"/);
  assert.match(app.innerHTML, /name="library_specialty"/);
  assert.match(app.innerHTML, /name="library_difficulty"/);
  assert.match(app.innerHTML, /data-library-exercise="c"/);
  listeners.get("change")({ target: { name: "library_age", value: "5" } });
  assert.match(app.innerHTML, /data-library-exercise="a"/);
  assert.doesNotMatch(app.innerHTML, /data-library-exercise="c"/);
});
