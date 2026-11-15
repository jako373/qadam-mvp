import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dashboard = readFileSync(new URL("../src/center-dashboard.js", import.meta.url), "utf8");
const functionCode = readFileSync(new URL("../supabase/functions/qadam-center-parent/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261105180000_expand_child_age_and_diagnosis_details.sql", import.meta.url), "utf8");

test("center registration derives age from a required birth date, without changing legacy records", () => {
  assert.match(dashboard, /name="birth_date"/);
  assert.match(functionCode, /child\.birth_date/);
  assert.match(functionCode, /age: child\.birth_date \? childAge\(child\.birth_date\) : Number\(child\.age\)/);
  assert.match(functionCode, /body\.child\.birth_date && !hasGuardian/);
  assert.match(migration, /age between 2 and 18/);
});

test("new enrollment records guardian contact without changing parent login", () => {
  assert.match(dashboard, /name="guardian_name"/);
  assert.match(dashboard, /name="guardian_phone"/);
  assert.match(functionCode, /center_guardians/);
  assert.match(functionCode, /phone_e164/);
});

test("editing a legacy child is scoped to the assigned staff member", () => {
  assert.match(functionCode, /async function updateProfile/);
  assert.match(functionCode, /await canEditChild\(actor, centerId, childId\)/);
  assert.match(functionCode, /body\.action === "update_profile"/);
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

test("child registration asks for name and optional surname before IIN", () => {
  assert.match(dashboard, /name: "Имя ребёнка", surname: "Фамилия ребёнка \(необязательно\)"/);
  assert.match(dashboard, /name: "Баланың аты", surname: "Баланың тегі \(міндетті емес\)"/);
  assert.match(dashboard, /name="name"[^>]*required><\/label>.*name="surname".*name="iin"/);
  assert.match(dashboard, /child\.name = \[data\.get\("surname"\), data\.get\("name"\)\].*\.join\(" "\)/);
});

test("specialist cabinet has bilingual section buttons and localized assessment questions", () => {
  assert.match(dashboard, /data-language="kk"/);
  assert.match(dashboard, /data-language="ru"/);
  assert.match(dashboard, /data-view="\$\{view\}"/);
  assert.match(dashboard, /question\[state\.language\]/);
});
