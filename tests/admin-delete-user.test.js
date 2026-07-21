import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const clientSource = readFileSync(new URL("../src/auth-entry.js", import.meta.url), "utf8");
const functionSource = readFileSync(new URL("../supabase/functions/qadam-admin-delete-user/index.ts", import.meta.url), "utf8");

test("superadmin CRM requires the user's email before account deletion", () => {
  assert.match(clientSource, /data-admin-action="delete-user"/);
  assert.match(clientSource, /Это действие нельзя отменить/);
  assert.match(clientSource, /confirmationEmail !== expectedEmail/);
  assert.match(clientSource, /qadam-admin-delete-user/);
});

test("delete endpoint protects superadmins and uses the server-side Auth Admin API", () => {
  assert.match(functionSource, /requireSuperadmin\(req\)/);
  assert.match(functionSource, /userId === actor\.id/);
  assert.match(functionSource, /target\.app_metadata\?\.role === "superadmin"/);
  assert.match(functionSource, /method: "DELETE"/);
  assert.match(functionSource, /serviceHeaders\(serviceKey\)/);
});
