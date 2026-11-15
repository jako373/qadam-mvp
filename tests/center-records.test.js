import assert from "node:assert/strict";
import { test } from "node:test";
import { childAge, normalizePhone, tuitionSummary, attendanceSummary } from "../src/lib/center-records.js";

test("birthday changes age only on the birthday; legacy age remains available", () => {
  assert.equal(childAge("2015-11-16", "2026-11-15", 7), 10);
  assert.equal(childAge("2015-11-16", "2026-11-16", 7), 11);
  assert.equal(childAge(null, "2026-11-15", 7), 7);
});

test("phone normalizes Kazakhstan trunk form but keeps valid international numbers", () => {
  assert.equal(normalizePhone("8 (701) 234-56-78"), "+77012345678");
  assert.equal(normalizePhone("+996 555 123 456"), "+996555123456");
  assert.equal(normalizePhone("123"), null);
});

test("tuition summary counts partial payments and signed corrections exactly", () => {
  assert.deepEqual(tuitionSummary(10000, [{ amount_kzt: 4000 }, { amount_kzt: 4000 }, { amount_kzt: -1000 }]), { charged: 10000, paid: 7000, due: 3000, overpaid: 0, status: "partial" });
  assert.deepEqual(tuitionSummary(10000, [{ amount_kzt: 12000 }]), { charged: 10000, paid: 12000, due: 0, overpaid: 2000, status: "paid" });
  assert.equal(tuitionSummary(null, []).status, "unset");
});

test("attendance counts sessions and unique local days separately", () => {
  const rows = [
    { status: "present", starts_at: "2026-11-15T01:00:00Z" },
    { status: "present", starts_at: "2026-11-15T10:00:00Z" },
    { status: "absent", starts_at: "2026-11-16T10:00:00Z" },
    { status: "cancelled", starts_at: "2026-11-17T10:00:00Z" },
    { status: "planned", starts_at: "2026-11-18T10:00:00Z" },
  ];
  assert.deepEqual(attendanceSummary(rows, "Asia/Qyzylorda"), { attended: 2, days: 1, absent: 1, cancelled: 1, planned: 1, lastAttended: "2026-11-15" });
});
