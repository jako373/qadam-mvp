const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const KASPI_PAY_URL = "https://pay.kaspi.kz/pay/t51uofa4";

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function isAllowedKaspiReceiptUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "receipt.kaspi.kz" && ["/web", "/web/fiscal"].includes(url.pathname) && !url.username && !url.password && !url.hash;
  } catch { return false; }
}

export async function fileSha256(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertReceiptFile(file) {
  if (!file || !MIME_TYPES.has(file.type)) throw new Error("Загрузите PDF, JPEG, PNG или WebP.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Файл больше 10 МБ. Уменьшите его и попробуйте снова.");
}

function rotatedCanvas(source, angle) {
  if (!angle) return source;
  const canvas = document.createElement("canvas");
  const swap = angle % 180 !== 0;
  canvas.width = swap ? source.height : source.width;
  canvas.height = swap ? source.width : source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((angle * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

async function detectCanvas(canvas) {
  const attempts = [0, 90, 180, 270].map((angle) => rotatedCanvas(canvas, angle));
  if ("BarcodeDetector" in globalThis) {
    try {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      for (const attempt of attempts) {
        const results = await detector.detect(attempt);
        const value = results.find((result) => isAllowedKaspiReceiptUrl(result.rawValue))?.rawValue;
        if (value) return value;
      }
    } catch { /* ZXing below */ }
  }
  if (globalThis.ZXingBrowser?.BrowserQRCodeReader) {
    const reader = new globalThis.ZXingBrowser.BrowserQRCodeReader();
    for (const attempt of attempts) {
      try {
        const result = await reader.decodeFromCanvas(attempt);
        const value = result?.getText?.() || result?.text;
        if (isAllowedKaspiReceiptUrl(value)) return value;
      } catch { /* try next rotation */ }
    }
  }
  return null;
}

async function imageToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

async function extractFromPdf(file) {
  const pdfjs = await import("/public/vendor/pdfjs/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/public/vendor/pdfjs/pdf.worker.mjs";
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  for (let pageNumber = 1; pageNumber <= Math.min(3, pdf.numPages); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    for (const scale of [2, 3]) {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d", { willReadFrequently: true }), viewport }).promise;
      const value = await detectCanvas(canvas);
      if (value) return value;
    }
  }
  return null;
}

export async function extractKaspiReceiptUrl(file) {
  assertReceiptFile(file);
  return file.type === "application/pdf" ? extractFromPdf(file) : detectCanvas(await imageToCanvas(file));
}

function setStatus(checkout, tone, title, detail = "") {
  const box = checkout.querySelector("[data-payment-message]");
  if (!box) return;
  box.className = `payment-message ${tone}`;
  box.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`;
  box.hidden = false;
}

function revealUpload(checkout, order) {
  checkout.dataset.paymentOrderId = order.id;
  checkout.querySelector("[data-payment-start]").hidden = true;
  checkout.querySelector("[data-payment-upload]").hidden = false;
  checkout.querySelector("[data-payment-order-code]").textContent = order.id.slice(0, 8).toUpperCase();
}

export async function handlePaymentClick(event, context) {
  const start = event.target.closest("[data-start-kaspi-payment]");
  if (!start) return false;
  const checkout = start.closest("[data-payment-checkout]");
  start.disabled = true;
  setStatus(checkout, "loading", context.state.language === "ru" ? "Создаём заявку…" : "Өтінім жасалып жатыр…");
  try {
    const order = await globalThis.qadamAuth.createPaymentOrder(checkout.dataset.planCode);
    revealUpload(checkout, order);
    setStatus(checkout, "ready", context.state.language === "ru" ? "Заявка готова" : "Өтінім дайын", context.state.language === "ru" ? "Оплатите точную сумму в Kaspi Pay, затем загрузите чек." : "Kaspi Pay арқылы нақты соманы төлеп, чекті жүктеңіз.");
  } catch (error) {
    setStatus(checkout, "error", error.message);
    start.disabled = false;
  }
  return true;
}

export async function handlePaymentFile(event, context) {
  const input = event.target.closest("[data-kaspi-receipt]");
  if (!input) return false;
  const checkout = input.closest("[data-payment-checkout]");
  const file = input.files?.[0];
  input.disabled = true;
  setStatus(checkout, "loading", context.state.language === "ru" ? "Читаем QR-код…" : "QR-код оқылып жатыр…", context.state.language === "ru" ? "Файл обрабатывается только в вашем браузере." : "Файл тек браузеріңізде өңделеді.");
  try {
    assertReceiptFile(file);
    const hash = await fileSha256(file);
    const receiptUrl = await extractKaspiReceiptUrl(file);
    if (!receiptUrl) {
      await globalThis.qadamAuth.submitManualReceipt(checkout.dataset.paymentOrderId, file, hash);
      setStatus(checkout, "review", context.state.language === "ru" ? "QR не распознан — чек принят" : "QR танылмады — чек қабылданды", context.state.language === "ru" ? "Мы проверим его вручную. Повторная загрузка не нужна." : "Оны қолмен тексереміз. Қайта жүктеудің қажеті жоқ.");
      return true;
    }
    setStatus(checkout, "loading", context.state.language === "ru" ? "Проверяем чек в Kaspi…" : "Чек Kaspi-де тексеріліп жатыр…");
    const result = await globalThis.qadamAuth.verifyKaspiReceipt(checkout.dataset.paymentOrderId, receiptUrl, hash);
    if (result.status === "confirmed") {
      setStatus(checkout, "success", context.state.language === "ru" ? "Оплата подтверждена" : "Төлем расталды", context.state.language === "ru" ? `Полный доступ открыт до ${result.access_until}.` : `Толық қолжетімділік ${result.access_until} дейін ашылды.`);
      setTimeout(context.render, 900);
    }
  } catch (error) {
    setStatus(checkout, "error", error.message || "Не удалось проверить чек");
    input.disabled = false;
  }
  return true;
}

export { KASPI_PAY_URL };
