import assert from "node:assert/strict";
import { test } from "node:test";

test("a failed center-role lookup never opens the stale parent profile", async () => {
  const session = { access_token: "test", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "staff-1", app_metadata: { role: "parent" } } };
  const app = { innerHTML: "" };
  const redirects = [];
  globalThis.localStorage = { getItem: (key) => key === "qadam.auth.session.v1" ? JSON.stringify(session) : key === "qadam.mvp.state.v1" ? JSON.stringify({ progress: { onboardingCompleted: true }, childProfile: { name: "Другой ребёнок" } }) : null };
  globalThis.document = { getElementById: () => app, documentElement: { lang: "" } };
  globalThis.location = { pathname: "/center", replace: (path) => redirects.push(path) };
  globalThis.fetch = async () => { throw new Error("network unavailable"); };

  await import(`../src/auth-entry.js?lookup-failure=${Date.now()}`);

  assert.deepEqual(redirects, []);
  assert.match(app.innerHTML, /Не удалось проверить доступ к центру/);
});
