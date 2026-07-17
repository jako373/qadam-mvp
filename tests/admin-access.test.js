import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../src/auth-entry.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260717191529_admin_access_durations.sql", import.meta.url),
  "utf8",
);

describe("superadmin navigation and access periods", () => {
  it("uses a real home link on onboarding and assessment screens", () => {
    assert.match(appSource, /class="utility-home" href="\/"/);
    assert.doesNotMatch(appSource, /class="utility-home" data-route=/);
  });

  it("shows a direct parent cabinet link in the CRM", () => {
    assert.match(authSource, />Кабинет родителя<\/a>/);
    assert.match(authSource, /href="\$\{userDestination\(\)\}"/);
  });

  it("offers every requested access period", () => {
    for (const period of ["month", "quarter", "half_year", "year", "lifetime"]) {
      assert.match(authSource, new RegExp(`option value="${period}"`));
      assert.match(migration, new RegExp(`'${period}'`));
    }
  });

  it("calculates expiry in the database and limits the RPC to superadmins", () => {
    assert.match(migration, /private\.is_superadmin\(\)/);
    assert.match(migration, /current_date \+ interval '1 month'/);
    assert.match(migration, /current_date \+ interval '3 months'/);
    assert.match(migration, /current_date \+ interval '6 months'/);
    assert.match(migration, /current_date \+ interval '1 year'/);
    assert.match(migration, /revoke all on function public\.admin_grant_user_access/);
  });
});
