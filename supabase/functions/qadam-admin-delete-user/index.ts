import { cors, json, requireSuperadmin, serviceHeaders } from "../_shared/admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Метод не поддерживается" }, 405);

  try {
    const { user: actor, url, serviceKey } = await requireSuperadmin(req);
    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    const confirmationEmail = String(body.confirmation_email || "").trim().toLowerCase();

    if (!UUID_PATTERN.test(userId)) return json(req, { error: "Некорректный идентификатор пользователя" }, 400);
    if (userId === actor.id) return json(req, { error: "Нельзя удалить собственный аккаунт суперадмина" }, 400);

    const targetResponse = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: serviceHeaders(serviceKey),
    });
    const target = await targetResponse.json().catch(() => ({}));
    if (!targetResponse.ok) return json(req, { error: target.message || target.msg || "Пользователь не найден" }, targetResponse.status);

    const targetEmail = String(target.email || "").trim().toLowerCase();
    if (!targetEmail || confirmationEmail !== targetEmail) return json(req, { error: "Email подтверждения не совпадает" }, 400);
    if (target.app_metadata?.role === "superadmin") return json(req, { error: "Аккаунты суперадминов нельзя удалять через CRM" }, 403);

    const deleted = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: serviceHeaders(serviceKey),
    });
    const payload = await deleted.json().catch(() => ({}));
    if (!deleted.ok) {
      const message = payload.message || payload.msg || "Не удалось удалить пользователя";
      const storageHint = /storage|object/i.test(message) ? " Сначала удалите принадлежащие пользователю файлы из Storage." : "";
      return json(req, { error: `${message}${storageHint}` }, deleted.status);
    }

    return json(req, { ok: true, deleted_user_id: userId });
  } catch (error) {
    if (error instanceof Response) return error;
    return json(req, { error: error instanceof Error ? error.message : "Внутренняя ошибка" }, 500);
  }
});
