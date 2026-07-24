import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("offers WhatsApp support at the requested Kazakhstan number", () => {
  assert.match(indexSource, /href="https:\/\/wa\.me\/77780903480"/);
  assert.match(indexSource, /\+7 778 090 34 80/);
  assert.match(indexSource, /rel="noopener noreferrer"/);
});

test("offers the requested Qadam parent community invite", () => {
  assert.match(indexSource, /https:\/\/chat\.whatsapp\.com\/GNvX18zVDw821y7tsbBTue\?s=sh&amp;p=i&amp;mlu=0&amp;amv=1/);
  assert.match(indexSource, /Чат родителей Казахстана/);
  assert.match(indexSource, /Қазақстандағы ата-аналар чаты/);
});

test("keeps the contact dock clear of mobile navigation", () => {
  assert.match(stylesSource, /body:has\(\.app-shell\.with-nav\) \.contact-dock/);
  assert.match(stylesSource, /bottom: 94px/);
  assert.match(stylesSource, /\.contact-dock > summary:focus-visible/);
});
