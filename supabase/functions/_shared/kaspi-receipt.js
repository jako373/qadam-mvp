export const PLAN_BY_AMOUNT = Object.freeze({
  4990: { code: "month", months: 1 },
  9990: { code: "quarter", months: 3 },
  15990: { code: "half_year", months: 6 },
  27990: { code: "year", months: 12 },
});

export function normalizeKaspiReceiptUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("invalid_receipt_url"); }
  if (url.protocol !== "https:" || url.hostname !== "receipt.kaspi.kz" || !["/web", "/web/fiscal"].includes(url.pathname)) {
    throw new Error("invalid_receipt_url");
  }
  if (url.username || url.password || url.hash) throw new Error("invalid_receipt_url");
  return url.toString();
}

function resolveDevalue(payload, index, cache, resolving) {
  if (!Number.isInteger(index) || index < 0 || index >= payload.length) return null;
  if (cache.has(index)) return cache.get(index);
  if (resolving.has(index)) return null;
  resolving.add(index);
  const raw = payload[index];
  if (raw === null || typeof raw === "string" || typeof raw === "boolean" || typeof raw === "number") {
    cache.set(index, raw);
    resolving.delete(index);
    return raw;
  }
  const target = Array.isArray(raw) ? [] : {};
  cache.set(index, target);
  if (Array.isArray(raw)) {
    for (const value of raw) target.push(typeof value === "number" ? resolveDevalue(payload, value, cache, resolving) : value);
  } else {
    for (const [key, value] of Object.entries(raw)) {
      target[key] = typeof value === "number" ? (value < 0 ? null : resolveDevalue(payload, value, cache, resolving)) : value;
    }
  }
  resolving.delete(index);
  return target;
}

function findReceipt(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if ("extTranId" in value && "amount" in value && ("payParameters" in value || "cartItems" in value)) return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const result = findReceipt(child, seen);
    if (result) return result;
  }
  return null;
}

export function parseKaspiNuxtHtml(html) {
  const match = String(html).match(/<script[^>]+id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("kaspi_format_changed");
  let payload;
  try { payload = JSON.parse(match[1]); } catch { throw new Error("kaspi_format_changed"); }
  if (!Array.isArray(payload)) throw new Error("kaspi_format_changed");
  const roots = payload.map((_, index) => resolveDevalue(payload, index, new Map(), new Set()));
  const receipt = findReceipt(roots);
  if (!receipt) throw new Error("kaspi_format_changed");

  const parameters = new Map((receipt.payParameters || []).map((row) => [String(row.type || row.name || "").toLowerCase(), String(row.value || "").trim()]));
  const parameter = (...keys) => {
    for (const key of keys) if (parameters.has(key)) return parameters.get(key);
    for (const row of receipt.payParameters || []) {
      const label = `${row.type || ""} ${row.name || ""}`.toLowerCase();
      if (keys.some((key) => label.includes(key))) return String(row.value || "").trim();
    }
    return "";
  };
  const amount = Number(String(receipt.amount ?? "").replace(/[^0-9.,-]/g, "").replace(",", "."));
  return {
    status: String(receipt.amountTitle || receipt.status || "").trim(),
    amountKzt: Number.isFinite(amount) ? Math.round(amount) : NaN,
    extTranId: String(receipt.extTranId || "").trim(),
    fiscalSign: parameter("fpd", "фп"),
    rnm: parameter("kgd_registry_id", "рнм"),
    bin: parameter("bin", "бин"),
    merchant: String(receipt.title || receipt.merchantName || "").trim(),
    itemName: String(receipt.cartItems?.[0]?.item_name || receipt.cartItems?.[0]?.name || "").trim(),
    saleDate: String(receipt.saleDate || receipt.date || "").trim(),
    orderType: String(receipt.orderType || "").trim().toUpperCase(),
  };
}

function folded(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleUpperCase("ru");
}

export function validateKaspiReceipt(receipt, expectedPlanCode) {
  const failures = [];
  if (folded(receipt.status) !== folded("Оплата совершена")) failures.push("payment_not_completed");
  if (receipt.orderType !== "BUY") failures.push("not_a_purchase");
  if (receipt.bin !== "900316301004") failures.push("merchant_bin_mismatch");
  if (receipt.rnm !== "600404801200") failures.push("cash_register_mismatch");
  if (folded(receipt.merchant) !== folded("ИП AIQYN AI AGENCY")) failures.push("merchant_name_mismatch");
  if (folded(receipt.itemName) !== folded("Подписка")) failures.push("item_mismatch");
  if (!receipt.extTranId || !receipt.fiscalSign) failures.push("missing_fiscal_identity");
  const plan = PLAN_BY_AMOUNT[receipt.amountKzt];
  if (!plan) failures.push("amount_not_a_tariff");
  else if (plan.code !== expectedPlanCode) failures.push("tariff_mismatch");
  const normalizedDate = receipt.saleDate.includes("T") ? receipt.saleDate : receipt.saleDate.replace(" ", "T");
  const saleAt = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(normalizedDate) ? normalizedDate : `${normalizedDate}+05:00`);
  if (!Number.isFinite(saleAt.getTime())) failures.push("invalid_sale_date");
  return { ok: failures.length === 0, failures, plan: plan || null, saleAt: Number.isFinite(saleAt.getTime()) ? saleAt.toISOString() : null };
}
