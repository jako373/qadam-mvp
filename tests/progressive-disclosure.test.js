import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const flowSource = readFileSync(new URL("../src/adaptive-flow.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("daily exercises keep the primary action before optional guidance", () => {
  const start = flowSource.indexOf("function renderDailyExercise");
  const end = flowSource.indexOf("function renderDailyResult");
  const dailySource = flowSource.slice(start, end);

  assert.match(dailySource, /<details class="lesson-disclosure lesson-preparation">/);
  assert.match(dailySource, /<section class="lesson-support"/);
  assert.ok(dailySource.indexOf('data-daily-next="${index}"') < dailySource.indexOf('<section class="lesson-support"'));
  assert.doesNotMatch(dailySource, /lesson-detail-grid/);
});

test("exercise details hide secondary explanations until requested", () => {
  const start = flowSource.indexOf("function renderExerciseDetail");
  const end = flowSource.indexOf("function renderAdaptiveProgress");
  const detailSource = flowSource.slice(start, end);

  assert.match(detailSource, /<section class="lesson-support detail-notes"/);
  assert.match(detailSource, /<details class="lesson-disclosure">/);
  assert.doesNotMatch(detailSource, /<article><strong>/);
});

test("optional child profile fields use progressive disclosure", () => {
  assert.match(appSource, /const hasComfortDetails = Boolean\(profile\.interests \|\| profile\.dislikes \|\| profile\.bestTime\)/);
  assert.match(appSource, /<details class="profile-form-section profile-comfort-section"/);
  assert.match(appSource, /optional: "Необязательно"/);
  assert.match(appSource, /optional: "Міндетті емес"/);
  assert.match(stylesSource, /\.profile-comfort-section > summary:focus-visible/);
});
