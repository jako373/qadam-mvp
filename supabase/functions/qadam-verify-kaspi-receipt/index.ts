import { cors, json, serviceHeaders } from "../_shared/admin.ts";
import { normalizeKaspiReceiptUrl, parseKaspiNuxtHtml, validateKaspiReceipt } from "../_shared/kaspi-receipt.js";

const MAX_HTML_BYTES = 1_000_000;

async function requireUser(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw json(req, { error: "Требуется авторизация" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
  if (!response.ok) throw json(req, { error: "Сессия недействительна" }, 401);
  return { user: await response.json(), url, serviceKey };
}

async function callRpc(url: string, serviceKey: string, name: string, body: Record<string, unknown>) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: serviceHeaders(serviceKey), body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `${name}_failed`);
  return payload;
}

async function fetchOfficialReceipt(initialUrl: string) {
  let current = normalizeKaspiReceiptUrl(initialUrl);
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "QadamReceiptVerifier/1.0", Accept: "text/html" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("kaspi_bad_redirect");
      current = normalizeKaspiReceiptUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error("kaspi_unavailable");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_HTML_BYTES) throw new Error("kaspi_response_too_large");
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) throw new Error("kaspi_response_too_large");
    return { html, finalUrl: current };
  }
  throw new Error("kaspi_too_many_redirects");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Метод не поддерживается" }, 405);
  let orderId = "";
  let fileHash = "";
  try {
    const { user, url, serviceKey } = await requireUser(req);
    const body = await req.json();
    orderId = String(body.order_id || "");
    fileHash = String(body.file_sha256 || "").toLowerCase();
    const receiptUrl = normalizeKaspiReceiptUrl(body.receipt_url);
    if (!/^[0-9a-f]{64}$/.test(fileHash)) return json(req, { error: "Некорректный файл" }, 400);

    const orderResponse = await fetch(`${url}/rest/v1/payment_orders?select=id,user_id,requested_plan_code,status,created_at&id=eq.${encodeURIComponent(orderId)}&limit=1`, { headers: serviceHeaders(serviceKey) });
    const orders = await orderResponse.json();
    const order = orders?.[0];
    if (!order || order.user_id !== user.id) return json(req, { error: "Заявка не найдена" }, 404);
    if (order.status === "confirmed") return json(req, { ok: true, status: "confirmed", idempotent: true });
    if (["rejected", "expired", "refunded"].includes(order.status)) return json(req, { error: "Заявка закрыта" }, 409);
    await fetch(`${url}/rest/v1/payment_orders?id=eq.${encodeURIComponent(orderId)}`, { method: "PATCH", headers: serviceHeaders(serviceKey), body: JSON.stringify({ status: "verifying", file_sha256: fileHash, updated_at: new Date().toISOString() }) });

    let official;
    try { official = await fetchOfficialReceipt(receiptUrl); }
    catch (error) {
      await callRpc(url, serviceKey, "mark_kaspi_payment_review", { p_order_id: orderId, p_status: "manual_review", p_reason: error instanceof Error ? error.message : "kaspi_unavailable", p_file_sha256: fileHash });
      return json(req, { ok: false, status: "manual_review", error: "Kaspi временно недоступен. Чек передан на ручную проверку." }, 503);
    }

    let receipt;
    try { receipt = parseKaspiNuxtHtml(official.html); }
    catch (error) {
      await callRpc(url, serviceKey, "mark_kaspi_payment_review", { p_order_id: orderId, p_status: "manual_review", p_reason: error instanceof Error ? error.message : "kaspi_format_changed", p_file_sha256: fileHash });
      return json(req, { ok: false, status: "manual_review", error: "Формат чека изменился. Чек передан на ручную проверку." }, 503);
    }

    const validation = validateKaspiReceipt(receipt, order.requested_plan_code);
    if (!validation.ok) {
      await callRpc(url, serviceKey, "mark_kaspi_payment_review", { p_order_id: orderId, p_status: "rejected", p_reason: validation.failures.join(","), p_file_sha256: fileHash });
      return json(req, { ok: false, status: "rejected", error: "Чек не соответствует выбранному тарифу или реквизитам Qadam.", reasons: validation.failures }, 422);
    }

    const result = await callRpc(url, serviceKey, "finalize_kaspi_payment", {
      p_order_id: orderId, p_file_sha256: fileHash, p_receipt_url: official.finalUrl,
      p_ext_tran_id: receipt.extTranId, p_fiscal_sign: receipt.fiscalSign, p_rnm: receipt.rnm,
      p_bin: receipt.bin, p_merchant: receipt.merchant, p_item_name: receipt.itemName,
      p_amount_kzt: receipt.amountKzt, p_sale_at: validation.saleAt,
    });
    return json(req, { ...result, status: "confirmed" });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Внутренняя ошибка";
    const duplicate = message.toLowerCase().includes("already used") || message.includes("23505");
    return json(req, { ok: false, status: duplicate ? "rejected" : "manual_review", error: duplicate ? "Этот чек уже был использован." : message }, duplicate ? 409 : 500);
  }
});
