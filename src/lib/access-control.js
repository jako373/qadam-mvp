export const FREE_EXERCISE_LIMIT = 3;

export const SUBSCRIPTION_PLANS = Object.freeze([
  { code: "month", months: 1, priceKzt: 4990 },
  { code: "quarter", months: 3, priceKzt: 9990 },
  { code: "half_year", months: 6, priceKzt: 15990 },
  { code: "year", months: 12, priceKzt: 27990, featured: true },
]);

export function normalizeAccess(value = {}) {
  const tier = ["standard", "paid", "complimentary", "blocked"].includes(value?.access_tier)
    ? value.access_tier
    : "standard";
  return {
    access_tier: tier,
    access_until: /^\d{4}-\d{2}-\d{2}$/.test(value?.access_until || "") ? value.access_until : null,
    plan_code: SUBSCRIPTION_PLANS.some((plan) => plan.code === value?.plan_code) ? value.plan_code : null,
    role: ["parent", "admin", "superadmin"].includes(value?.role) ? value.role : "parent",
  };
}

export function hasFullAccess(value = {}, today = new Date().toISOString().slice(0, 10)) {
  const access = normalizeAccess(value);
  if (["admin", "superadmin"].includes(access.role)) return true;
  if (!["paid", "complimentary"].includes(access.access_tier)) return false;
  return !access.access_until || access.access_until >= today;
}

export function firstPlanEntry(adaptive = {}) {
  const plans = adaptive?.dailyPlans && typeof adaptive.dailyPlans === "object"
    ? adaptive.dailyPlans
    : {};
  const firstDate = Object.keys(plans).sort()[0];
  return firstDate ? { date: firstDate, plan: plans[firstDate] } : null;
}

export function freeExerciseIds(adaptive = {}) {
  const first = firstPlanEntry(adaptive);
  if (!first?.plan?.items) return [];
  return first.plan.items
    .slice(0, FREE_EXERCISE_LIMIT)
    .map((item) => item.exerciseId)
    .filter(Boolean);
}

export function freemiumRouteRedirect(path, state, access) {
  if (hasFullAccess(access)) return null;
  if (["/subscription", "/today", "/progress", "/profile", "/daily-summary"].includes(path)) return null;
  if (path.startsWith("/recheck/")) return "/subscription";

  const first = firstPlanEntry(state?.adaptive);
  const activeDate = state?.adaptive?.activePlanDate || first?.date || null;
  if ((path.startsWith("/daily/") || path.startsWith("/daily-results/")) && first?.date && activeDate !== first.date) {
    return "/subscription";
  }

  if (path.startsWith("/library/")) {
    const exerciseId = path.split("/").pop();
    return freeExerciseIds(state?.adaptive).includes(exerciseId) ? null : "/subscription";
  }
  return null;
}

export function formatKzt(value) {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value) || 0)} ₸`;
}

