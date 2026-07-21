import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authSource = readFileSync(new URL("../src/auth-entry.js", import.meta.url), "utf8");
const authStyles = readFileSync(new URL("../src/auth.css", import.meta.url), "utf8");

test("password fields expose an accessible visibility toggle", () => {
  assert.match(authSource, /function passwordField\(name, autocomplete\)/);
  assert.match(authSource, /data-password-toggle aria-label="Показать пароль" aria-pressed="false"/);
  assert.match(authSource, /input\.type = visible \? "password" : "text"/);
  assert.match(authSource, /button\.setAttribute\("aria-pressed", String\(!visible\)\)/);
});

test("login, registration, and password reset mount visibility controls", () => {
  assert.equal((authSource.match(/mountPasswordToggles\(app\);/g) || []).length, 3);
  assert.match(authSource, /passwordField\("password", "current-password"\)/);
  assert.ok((authSource.match(/passwordField\("passwordConfirm", "new-password"\)/g) || []).length >= 2);
  assert.match(authStyles, /\.password-control/);
  assert.match(authStyles, /\.password-toggle\[aria-pressed="true"\]/);
});
