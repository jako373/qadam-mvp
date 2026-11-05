import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../src/auth-entry.js", import.meta.url), "utf8");
describe("superadmin navigation in center mode", () => {
  it("uses a real home link on onboarding and assessment screens", () => {
    assert.match(appSource, /class="utility-home" href="\/"/);
    assert.doesNotMatch(appSource, /class="utility-home" data-route=/);
  });

  it("shows a direct parent cabinet link in the CRM", () => {
    assert.match(authSource, />Кабинет родителя<\/a>/);
    assert.match(authSource, /href="\$\{userDestination\(\)\}"/);
  });

  it("shows a direct superadmin cabinet button in the parent interface", () => {
    assert.match(appSource, /function renderSuperadminModeSwitch\(\)/);
    assert.match(appSource, /class="superadmin-mode-switch" href="\/admin"/);
    assert.match(appSource, /Кабинет суперадмина/);
    assert.match(appSource, /Суперадмин кабинеті/);
    assert.match(authSource, /isAdmin\(session\) && !isSuperadmin\(session\)/);
  });

  it("routes the superadmin to the center and hides access periods", () => {
    assert.match(authSource, /href="\/center"/);
    assert.doesNotMatch(authSource, /option value="month"/);
  });
});
