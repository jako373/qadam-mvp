import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dashboard = readFileSync(new URL("../src/center-dashboard.js", import.meta.url), "utf8");
const functionCode = readFileSync(new URL("../supabase/functions/qadam-center-parent/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261105180000_expand_child_age_and_diagnosis_details.sql", import.meta.url), "utf8");

test("center registration supports ages 2–18 without changing the legacy exercise age range", () => {
  assert.match(dashboard, /length: 17.*index \+ 2/);
  assert.match(functionCode, /Number\(child\.age\) <= 18/);
  assert.match(migration, /age between 2 and 18/);
});

test("other diagnosis requires text and saves it separately", () => {
  assert.match(dashboard, /data-diagnosis-details/);
  assert.match(dashboard, /details\.querySelector\("input"\)\.required = other/);
  assert.match(functionCode, /child\.diagnosis_details\.trim\(\)\.length >= 2/);
  assert.match(functionCode, /diagnosis_details: child\.diagnosis === "Басқа \/ Другое"/);
});

test("specialist may enroll individually; chosen groups remain scoped", () => {
  assert.doesNotMatch(functionCode, /Выберите свою группу/);
  assert.match(functionCode, /if \(groupId\)/);
  assert.match(functionCode, /center_group_specialists\?select=group_id/);
  assert.match(functionCode, /center_group_students/);
  assert.match(functionCode, /center_specialist_students/);
});

test("specialist cabinet has bilingual section buttons and localized assessment questions", () => {
  assert.match(dashboard, /data-language="kk"/);
  assert.match(dashboard, /data-language="ru"/);
  assert.match(dashboard, /data-view="\$\{view\}"/);
  assert.match(dashboard, /question\[state\.language\]/);
});
