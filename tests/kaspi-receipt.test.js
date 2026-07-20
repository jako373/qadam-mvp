import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeKaspiReceiptUrl, parseKaspiNuxtHtml, PLAN_BY_AMOUNT, validateKaspiReceipt } from "../supabase/functions/_shared/kaspi-receipt.js";
import { isAllowedKaspiReceiptUrl } from "../src/payments.js";

function receiptHtml(overrides = {}) {
  const receipt = {
    amountTitle: 3, amount: 4, extTranId: 5, saleDate: 6, orderType: 7,
    title: 8, payParameters: 9, cartItems: 10, ...overrides,
  };
  const payload = [
    { data: 1 }, { receipt: 2 }, receipt,
    "Оплата совершена", 4990, "QR-SANITIZED-001", "2026-07-21 12:00:00.000000", "BUY", "ИП AIQYN AI AGENCY",
    [11, 12, 13], [14],
    { type: 15, value: 16 }, { type: 17, value: 18 }, { type: 19, value: 20 },
    { item_name: 21 }, "bin", "900316301004", "kgd_registry_id", "600404801200", "fpd", "SANITIZED-FISCAL-SIGN", "Подписка", 100,
  ];
  return `<html><body><script type="application/json" id="__NUXT_DATA__">${JSON.stringify(payload)}</script></body></html>`;
}

test("allows only official Kaspi receipt endpoints", () => {
  for (const url of ["https://receipt.kaspi.kz/web?x=1", "https://receipt.kaspi.kz/web/fiscal?i=1"]) {
    assert.equal(isAllowedKaspiReceiptUrl(url), true);
    assert.equal(normalizeKaspiReceiptUrl(url), url);
  }
  for (const url of ["http://receipt.kaspi.kz/web", "https://receipt.kaspi.kz.evil.test/web", "https://receipt.kaspi.kz/other", "https://user@receipt.kaspi.kz/web"]) {
    assert.equal(isAllowedKaspiReceiptUrl(url), false);
    assert.throws(() => normalizeKaspiReceiptUrl(url));
  }
});

test("parses Nuxt fiscal payload and validates the merchant", () => {
  const receipt = parseKaspiNuxtHtml(receiptHtml());
  assert.deepEqual(receipt, {
    status: "Оплата совершена", amountKzt: 4990, extTranId: "QR-SANITIZED-001", fiscalSign: "SANITIZED-FISCAL-SIGN",
    rnm: "600404801200", bin: "900316301004", merchant: "ИП AIQYN AI AGENCY", itemName: "Подписка",
    saleDate: "2026-07-21 12:00:00.000000", orderType: "BUY",
  });
  const validation = validateKaspiReceipt(receipt, "month");
  assert.equal(validation.ok, true);
  assert.equal(validation.saleAt, "2026-07-21T07:00:00.000Z");
});

test("all tariff amounts map exactly and a 100 KZT test receipt is rejected", () => {
  assert.deepEqual(Object.keys(PLAN_BY_AMOUNT).map(Number), [4990, 9990, 15990, 27990]);
  const receipt = parseKaspiNuxtHtml(receiptHtml({ amount: 22 }));
  const payloadAmount = receipt.amountKzt;
  assert.equal(payloadAmount, 100);
  const validation = validateKaspiReceipt(receipt, "month");
  assert.equal(validation.ok, false);
  assert.ok(validation.failures.includes("amount_not_a_tariff"));
});

test("rejects wrong merchant, RNM, product, operation and mismatched tariff", () => {
  const base = parseKaspiNuxtHtml(receiptHtml());
  const invalid = validateKaspiReceipt({ ...base, bin: "000", rnm: "000", merchant: "OTHER", itemName: "Другое", orderType: "RETURN" }, "year");
  assert.equal(invalid.ok, false);
  for (const reason of ["merchant_bin_mismatch", "cash_register_mismatch", "merchant_name_mismatch", "item_mismatch", "not_a_purchase", "tariff_mismatch"]) assert.ok(invalid.failures.includes(reason));
});

test("migration enforces RLS, receipt uniqueness and service-role-only activation", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260721120000_kaspi_receipt_payments.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /unique index[\s\S]+kaspi_ext_tran_id/i);
  assert.match(sql, /unique index[\s\S]+kaspi_fiscal_sign/i);
  assert.match(sql, /grant execute on function public\.finalize_kaspi_payment[\s\S]+to service_role/i);
  assert.match(sql, /revoke all on function public\.finalize_kaspi_payment[\s\S]+authenticated/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /status = 'confirmed'/i);
  assert.match(sql, /interval '7 days'/i);
});
