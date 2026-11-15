import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCenterDashboard } from "../src/center-dashboard.js";

test("specialist sees children, scheduling, exercises and profile without center administration", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ focus() {} }) };
  await renderCenterDashboard({ app, session: { access_token: "test", user: { id: "staff" } }, membership: { center_id: "center", role: "specialist", full_name: "Маман" }, dataRequest: async () => [] });
  const nav = app.innerHTML.match(/<nav class="center-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.deepEqual([...nav.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]), ["students", "schedule", "exercises", "settings"]);
  await listeners.get("click")({ target: { closest: () => ({ dataset: { view: "exercises" }, hasAttribute: (name) => name === "data-view" }) } });
  assert.match(app.innerHTML, /Библиотека упражнений/);
  assert.match(app.innerHTML, /name="library_search"/);
});

test("center loading failure replaces the Qadam splash with a retry message", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const app = { innerHTML: '<div class="boot">Qadam</div>', addEventListener() {}, querySelector: () => null };
  await renderCenterDashboard({
    app,
    session: { access_token: "test", user: { id: "staff" } },
    membership: { center_id: "center", role: "specialist", full_name: "Маман" },
    dataRequest: async (path) => { if (path === "rpc/active_exercises") return []; throw new Error("database unavailable"); },
  });
  assert.match(app.innerHTML, /role="alert"/);
  assert.match(app.innerHTML, /href="\/center"/);
  assert.doesNotMatch(app.innerHTML, /class="boot"/);
});

test("only center admin gets the payment tab and monthly status controls", async () => {
  globalThis.localStorage = { getItem: () => "kk", setItem() {} };
  globalThis.document = { documentElement: { lang: "kk" } };
  const rows = { center_students: [{ child_id: "child-1", active: true }], children: [{ id: "child-1", name: "Сынақ", age: 7 }], center_monthly_payment_marks: [{ child_id: "child-1", period_month: "2026-11-01", status: "paid" }] };
  const makeApp = () => { const listeners = new Map(); return { listeners, app: { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ focus() {} }) } }; };
  const writes = [];
  const dataRequest = async (path, _session, options) => {
    if (options?.method === "PATCH") { writes.push({ path, body: JSON.parse(options.body) }); rows.center_monthly_payment_marks[0].status = writes.at(-1).body.status; return []; }
    return path === "rpc/active_exercises" || path === "rpc/center_tuition_overview" ? [] : rows[path.split("?")[0]] || [];
  };
  const admin = makeApp();
  await renderCenterDashboard({ app: admin.app, session: { user: { id: "admin" } }, membership: { center_id: "center", role: "admin" }, dataRequest });
  assert.match(admin.app.innerHTML, /data-view="payments"/);
  await admin.listeners.get("click")({ target: { closest: () => ({ dataset: { view: "payments" }, hasAttribute: (name) => name === "data-view" }) } });
  assert.match(admin.app.innerHTML, /data-payment-child="child-1"/);
  assert.match(admin.app.innerHTML, /Төленді/);
  const mark = { dataset: { paymentChild: "child-1", paymentStatus: "unpaid" }, hasAttribute: (name) => name === "data-payment-child", disabled: false };
  await admin.listeners.get("click")({ target: { closest: () => mark } });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].body.status, "unpaid");
  assert.match(admin.app.innerHTML, /Төленбеді/);
  const specialist = makeApp();
  await renderCenterDashboard({ app: specialist.app, session: { user: { id: "staff" } }, membership: { center_id: "center", role: "specialist" }, dataRequest });
  assert.doesNotMatch(specialist.app.innerHTML, /data-view="payments"|data-payment-child=/);
  assert.match(specialist.app.innerHTML, /Оқу ақысы: төленбеген/);
});

test("partially paid ledger period counts as unsettled, not unmarked", async () => {
  const currentMonth = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Qyzylorda", year: "numeric", month: "2-digit" }).format(new Date());
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const listeners = new Map();
  const app = { innerHTML: "", addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => ({ focus() {} }) };
  await renderCenterDashboard({ app, session: { user: { id: "admin" } }, membership: { center_id: "center", role: "admin" }, dataRequest: async (path) => {
    if (path === "rpc/center_tuition_overview") return [{ status: "partial", period_start: `${currentMonth}-01`, period_end: `${currentMonth}-28` }];
    if (path.startsWith("center_students?")) return [{ child_id: "child-1", active: true }];
    if (path.startsWith("children?")) return [{ id: "child-1", name: "Test", age: 7 }];
    return [];
  } });
  await listeners.get("click")({ target: { closest: () => ({ dataset: { view: "payments" }, hasAttribute: (name) => name === "data-view" }) } });
  assert.match(app.innerHTML, /Не оплачено<strong>1<\/strong>/);
  assert.match(app.innerHTML, /Не отмечено<strong>0<\/strong>/);
  assert.match(app.innerHTML, /Частично/);
});
