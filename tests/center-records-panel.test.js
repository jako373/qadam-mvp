import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCenterChildRecords } from "../src/center-records-panel.js";

const child = { id: "child-1", name: "Сынақ", age: 7, birth_date: null };
const sessions = [
  { id: "s1", child_id: "child-1", starts_at: "2026-11-15T01:00:00Z", status: "present", topic: "A", duration_minutes: 45, specialist_id: "u1" },
  { id: "s2", child_id: "child-1", starts_at: "2026-11-15T10:00:00Z", status: "present", topic: "B", duration_minutes: 45, specialist_id: "u1" },
];
const base = { child, guardian: null, sessions, tuition: [], charges: [], paymentEvents: [], enrollmentEvents: [], month: "2026-11", from: "", to: "", memberName: () => "Маман", today: "2026-11-15" };

test("legacy child remains readable and attendance counts sessions and days", () => {
  const html = renderCenterChildRecords({ ...base, admin: false, language: "ru" });
  assert.match(html, /Дата рождения не указана/);
  assert.match(html, /Посещено занятий[^<]*<strong>2<\/strong>/);
  assert.match(html, /Дней посещения[^<]*<strong>1<\/strong>/);
  assert.match(html, /Ноябрь 2026/);
});

test("specialist sees payment status without sums or finance forms", () => {
  const html = renderCenterChildRecords({ ...base, admin: false, language: "ru", tuition: [{ id: "c1", period_start: "2026-11-01", period_end: "2026-11-30", status: "partial", charged: null, paid: null }] });
  assert.match(html, /Частично оплачено/);
  assert.doesNotMatch(html, /10000|name="amount_kzt"|Добавить начисление/);
});

test("admin sees finance and pause controls with actual future sessions", () => {
  const html = renderCenterChildRecords({ ...base, admin: true, language: "kk", tuition: [{ id: "c1", period_start: "2026-11-01", period_end: "2026-11-30", status: "partial", charged: 10000, paid: 4000, due: 6000, overpaid: 0 }] });
  assert.match(html, /10[\s\u00a0]?000/);
  assert.match(html, /name="amount_kzt"/);
  assert.match(html, /Оқуды уақытша тоқтату/);
  assert.match(html, /Қараша 2026/);
});

test("pause preview counts selected billing period only up to chosen date", () => {
  const tuition = [
    { id: "old", period_start: "2026-11-01", period_end: "2026-11-30", status: "paid" },
    { id: "new", period_start: "2026-12-01", period_end: "2026-12-31", status: "paid" },
  ];
  const html = renderCenterChildRecords({ ...base, admin: true, tuition, selectedPeriodId: "old", pauseDate: "2026-11-14" });
  assert.match(html, /value="old" selected/);
  assert.match(html, /2026-11-14\): <strong>0<\/strong>/);
  const later = renderCenterChildRecords({ ...base, admin: true, tuition, selectedPeriodId: "old", pauseDate: "2026-11-15" });
  assert.match(later, /2026-11-15\): <strong>2<\/strong>/);
});
