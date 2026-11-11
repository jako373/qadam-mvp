import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCenterDashboard } from "../src/center-dashboard.js";

test("center administrator sees active children, specialists, homework and parent responses", async () => {
  globalThis.localStorage = { getItem: () => "ru", setItem() {} };
  globalThis.document = { documentElement: { lang: "ru" } };
  const app = { innerHTML: "", addEventListener() {} };
  const dataRequest = async (path) => {
    if (path.startsWith("center_students?")) return [{ child_id: "one" }, { child_id: "two" }];
    if (path.startsWith("children?")) return [{ id: "one", name: "Один", age: 4 }, { id: "two", name: "Два", age: 5 }];
    if (path.startsWith("center_staff?")) return [{ user_id: "admin", role: "admin" }, { user_id: "staff-one", role: "specialist" }, { user_id: "staff-two", role: "specialist" }];
    if (path.startsWith("center_homework?")) return [{ child_id: "one", exercise_ids: ["a", "b"], responses: { a: { result: "done", at: "2026-11-11T10:00:00Z" } }, assigned_at: "2026-11-11T09:00:00Z" }, { child_id: "two", exercise_ids: ["c"], responses: {}, assigned_at: "2026-11-10T09:00:00Z" }];
    return [];
  };
  await renderCenterDashboard({ app, session: { user: { id: "admin" } }, membership: { center_id: "center", role: "admin", full_name: "Админ" }, dataRequest });
  assert.match(app.innerHTML, /<strong>2<\/strong><span>Активных детей/);
  assert.match(app.innerHTML, /<strong>2<\/strong><span>Специалистов/);
  assert.match(app.innerHTML, /<strong>2<\/strong><span>Отправлено заданий/);
  assert.match(app.innerHTML, /<strong>1<\/strong><span>Ответов родителей/);
});
