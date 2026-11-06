import assert from "node:assert/strict";
import { test } from "node:test";
import { homeDestination, workspaceRedirect } from "../src/lib/workspace-routes.js";
import { renderCenterDashboard } from "../src/center-dashboard.js";

const specialist = { user: { id: "staff-1", app_metadata: { role: "parent" } } };
const membership = { center_id: "center-1", role: "specialist" };
const centerParent = { user: { id: "parent-1", app_metadata: { role: "parent", center_parent: true } } };
const superadmin = { user: { id: "owner-1", app_metadata: { role: "superadmin" } } };

test("specialist cannot open a parent, family, payment or platform admin workspace", () => {
  for (const path of ["/today", "/daily/1", "/progress", "/family", "/subscription", "/admin", "/account-mode"]) {
    assert.equal(workspaceRedirect(path, specialist, membership, "/today"), "/center", path);
  }
  assert.equal(workspaceRedirect("/center", specialist, membership, "/today"), null);
  assert.equal(workspaceRedirect("/", specialist, membership, "/today"), null);
});

test("family cabinet stays exclusive to center parents and superadmin", () => {
  assert.equal(workspaceRedirect("/family", specialist, null, "/today"), "/today");
  assert.equal(workspaceRedirect("/family", centerParent, null, "/today"), null);
  assert.equal(workspaceRedirect("/today", centerParent, null, "/today"), "/family");
  assert.equal(workspaceRedirect("/family", superadmin, membership, "/today"), null);
});

test("landing continuation follows the signed-in workspace, not another account's saved profile", () => {
  assert.equal(homeDestination(specialist, membership, true), "/center");
  assert.equal(homeDestination(centerParent, null, true), "/family");
  assert.equal(homeDestination(superadmin, membership, true), "/account-mode");
  assert.equal(homeDestination(specialist, null, true), "/today");
  assert.equal(homeDestination(null, null, true), "/login");
});

test("specialist's header home link stays in the center workspace", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const app = { innerHTML: "", addEventListener() {}, querySelector: () => null };
  await renderCenterDashboard({ app, session: specialist, membership: { ...membership, full_name: "Specialist", center_name: "Qadam" }, dataRequest: async () => [] });
  assert.match(app.innerHTML, /<header class="center-header"><a href="\/center"/);
});
