import { cors, json, requireSuperadmin, serviceHeaders } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Метод не поддерживается" }, 405);
  try {
    const { url, serviceKey } = await requireSuperadmin(req);
    const { order_id: orderId } = await req.json();
    const response = await fetch(`${url}/rest/v1/payment_orders?select=receipt_storage_path&id=eq.${encodeURIComponent(String(orderId || ""))}&status=eq.manual_review&limit=1`, { headers: serviceHeaders(serviceKey) });
    const rows = await response.json();
    const path = rows?.[0]?.receipt_storage_path;
    if (!path) return json(req, { error: "Файл ручной проверки не найден" }, 404);
    const signed = await fetch(`${url}/storage/v1/object/sign/payment-receipts/${path}`, {
      method: "POST", headers: serviceHeaders(serviceKey), body: JSON.stringify({ expiresIn: 300 }),
    });
    const payload = await signed.json();
    if (!signed.ok) return json(req, { error: payload.message || "Не удалось открыть чек" }, 500);
    const signedUrl = payload.signedURL?.startsWith("http") ? payload.signedURL : `${url}/storage/v1${payload.signedURL}`;
    return json(req, { url: signedUrl, expires_in: 300 });
  } catch (error) {
    if (error instanceof Response) return error;
    return json(req, { error: error instanceof Error ? error.message : "Внутренняя ошибка" }, 500);
  }
});
