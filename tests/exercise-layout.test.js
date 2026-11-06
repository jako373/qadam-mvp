import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const center = readFileSync(new URL("../src/center.css", import.meta.url), "utf8");
const parent = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("schedule row styles do not collapse nested exercise steps", () => {
  assert.doesNotMatch(center, /\.center-session-list\s+li\s*\{/);
  assert.match(center, /\.center-session-list>li\s*\{/);
});

test("desktop exercise layouts give illustrations and instructions separate columns", () => {
  assert.match(center, /\.center-lesson-detail\s*\{[^}]*grid-template-columns:\s*minmax\(/s);
  assert.match(parent, /\.daily-exercise\s*\{[^}]*grid-template-columns:\s*minmax\(/s);
});
