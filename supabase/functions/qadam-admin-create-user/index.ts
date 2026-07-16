import { cors, json, requireSuperadmin, serviceHeaders } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Метод не поддерживается" }, 405);
  try {
    const { user: actor, url, serviceKey } = await requireSuperadmin(req);
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "parent";
    const fullAccess = Boolean(body.full_access);
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(req, { error: "Введите корректный email" }, 400);
    if (password.length < 8) return json(req, { error: "Временный пароль должен содержать минимум 8 символов" }, 400);

    const created = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role } }),
    });
    const user = await created.json();
    if (!created.ok) return json(req, { error: user.message || user.msg || "Не удалось создать пользователя" }, created.status);

    if (fullAccess) {
      await fetch(`${url}/rest/v1/account_access?on_conflict=user_id`, {
        method: "POST",
        headers: serviceHeaders(serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ user_id: user.id, access_tier: "complimentary", note: "Полный бесплатный доступ при создании", updated_by: actor.id }),
      });
    }
    return json(req, { ok: true, user: { id: user.id, email: user.email, role, full_access: fullAccess } });
  } catch (error) {
    if (error instanceof Response) return error;
    return json(req, { error: error instanceof Error ? error.message : "Внутренняя ошибка" }, 500);
  }
});
