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
