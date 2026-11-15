export function childAge(birthDate, asOfDate, legacyAge = null) {
  if (!birthDate) return legacyAge == null ? null : Number(legacyAge);
  const [year, month, day] = birthDate.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = asOfDate.split("-").map(Number);
  if (![year, month, day, nowYear, nowMonth, nowDay].every(Number.isInteger)) return null;
  return nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0);
}

export function normalizePhone(value) {
  const input = String(value || "").trim();
  if (!/^[+\d\s()\-.]+$/.test(input)) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = `7${digits.slice(1)}`;
  if (!input.startsWith("+") && digits[0] !== "7") return null;
  if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
  return `+${digits}`;
}

export function tuitionSummary(charged, entries = []) {
  if (charged == null) return { charged: 0, paid: 0, due: 0, overpaid: 0, status: "unset" };
  if (!Number.isSafeInteger(charged) || charged < 0) throw new Error("Invalid charge");
  const paid = entries.reduce((total, entry) => {
    if (!Number.isSafeInteger(entry.amount_kzt)) throw new Error("Invalid payment");
    return total + entry.amount_kzt;
  }, 0);
  if (!Number.isSafeInteger(paid)) throw new Error("Payment total overflow");
  return {
    charged, paid,
    due: Math.max(0, charged - paid),
    overpaid: Math.max(0, paid - charged),
    status: paid >= charged ? "paid" : paid > 0 ? "partial" : "unpaid",
  };
}

function localDay(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function attendanceSummary(sessions, timeZone = "Asia/Qyzylorda") {
  const days = new Set();
  let attended = 0, absent = 0, cancelled = 0, planned = 0, lastAttended = null;
  for (const session of sessions) {
    if (session.status === "present") {
      attended += 1;
      const day = localDay(session.starts_at, timeZone);
      days.add(day);
      if (!lastAttended || day > lastAttended) lastAttended = day;
    } else if (session.status === "absent") absent += 1;
    else if (session.status === "cancelled") cancelled += 1;
    else planned += 1;
  }
  return { attended, days: days.size, absent, cancelled, planned, lastAttended };
}
