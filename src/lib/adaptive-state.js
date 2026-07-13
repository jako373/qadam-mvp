import { exerciseCategoryOrder } from "../data/exercise-localization.js";

export const exerciseOutcomes = ["independent", "assisted", "unable", "refused"];
const planVariants = ["balanced", "easier", "guided", "progress", "alternative"];

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey, days = 1) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey));
  if (!match) return todayKey();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + Number(days || 0));
  return todayKey(date);
}

export function createDefaultSkillLevels() {
  return Object.fromEntries(exerciseCategoryOrder.map((category) => [category, 1]));
}

export function createDefaultAdaptiveState() {
  return {
    initialAssessment: { answers: {}, completedAt: null },
    reassessment: { answers: {}, startedAt: null },
    skillLevels: createDefaultSkillLevels(),
    exerciseProgress: {},
    exerciseHistory: [],
    introducedExerciseIds: [],
    favoriteExerciseIds: [],
    activePlanDate: null,
    dailyPlans: {},
    completedDates: [],
    lastReassessmentAt: null,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return (
    date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
  );
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function nonnegativeInteger(value, maximum = 10000) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, Math.min(maximum, number)) : 0;
}

function normalizeAnswers(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, answer]) =>
      answer === null || answer === 0 || answer === 1 || answer === 2,
    ),
  );
}

function normalizeExerciseProgress(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([exerciseId, item]) => typeof exerciseId === "string" && isRecord(item))
      .map(([exerciseId, item]) => [exerciseId, {
        independentCount: nonnegativeInteger(item.independentCount),
        unableStreak: nonnegativeInteger(item.unableStreak),
        attempts: nonnegativeInteger(item.attempts),
        lastOutcome: exerciseOutcomes.includes(item.lastOutcome) ? item.lastOutcome : null,
        lastDate: isDateKey(item.lastDate) ? item.lastDate : null,
      }]),
  );
}

function normalizeDailyPlans(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([date, plan]) => isDateKey(date) && isRecord(plan))
      .map(([date, plan]) => {
        const items = Array.isArray(plan.items)
          ? plan.items
              .filter((item) => isRecord(item) && typeof item.exerciseId === "string")
              .map((item) => ({
                exerciseId: item.exerciseId,
                isNew: item.isNew === true,
                variant: planVariants.includes(item.variant) ? item.variant : "balanced",
              }))
          : [];
        const results = isRecord(plan.results)
          ? Object.fromEntries(
              Object.entries(plan.results).filter(([, outcome]) =>
                exerciseOutcomes.includes(outcome),
              ),
            )
          : {};
        return [date, {
          date: isDateKey(plan.date) ? plan.date : date,
          basedOnDate: isDateKey(plan.basedOnDate) ? plan.basedOnDate : null,
          items,
          results,
          viewedCount: nonnegativeInteger(plan.viewedCount, 3),
          completedAt: validTimestamp(plan.completedAt),
        }];
      }),
  );
}

function uniqueStrings(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string"))]
    : [];
}

function validLevel(value) {
  const level = Number(value);
  return level === 2 || level === 3 ? level : 1;
}

export function normalizeAdaptiveState(value) {
  const defaults = createDefaultAdaptiveState();
  if (!isRecord(value)) return defaults;

  const initialAssessment = isRecord(value.initialAssessment) ? value.initialAssessment : {};
  const answers = normalizeAnswers(initialAssessment.answers);
  const reassessment = isRecord(value.reassessment) ? value.reassessment : {};
  const reassessmentAnswers = normalizeAnswers(reassessment.answers);
  const skillLevels = createDefaultSkillLevels();
  if (isRecord(value.skillLevels)) {
    for (const category of exerciseCategoryOrder) {
      skillLevels[category] = validLevel(value.skillLevels[category]);
    }
  }

  const exerciseProgress = normalizeExerciseProgress(value.exerciseProgress);
  const dailyPlans = normalizeDailyPlans(value.dailyPlans);
  const activePlanDate = isDateKey(value.activePlanDate) && dailyPlans[value.activePlanDate]
    ? value.activePlanDate
    : null;
  const history = Array.isArray(value.exerciseHistory)
    ? value.exerciseHistory
        .filter((item) =>
          isRecord(item) &&
          typeof item.exerciseId === "string" &&
          exerciseCategoryOrder.includes(item.category) &&
          exerciseOutcomes.includes(item.outcome) &&
          isDateKey(item.date),
        )
        .map((item) => ({
          exerciseId: item.exerciseId,
          category: item.category,
          level: validLevel(item.level),
          outcome: item.outcome,
          score: item.outcome === "refused" ? null : item.outcome === "independent" ? 2 : item.outcome === "assisted" ? 1 : 0,
          date: item.date,
          at: validTimestamp(item.at) || `${item.date}T12:00:00.000Z`,
        }))
    : [];

  return {
    initialAssessment: {
      answers,
      completedAt: validTimestamp(initialAssessment.completedAt),
    },
    reassessment: {
      answers: reassessmentAnswers,
      startedAt: validTimestamp(reassessment.startedAt),
    },
    skillLevels,
    exerciseProgress,
    exerciseHistory: history.slice(-500),
    introducedExerciseIds: uniqueStrings(value.introducedExerciseIds),
    favoriteExerciseIds: uniqueStrings(value.favoriteExerciseIds),
    activePlanDate,
    dailyPlans,
    completedDates: uniqueStrings(value.completedDates).filter(isDateKey).sort(),
    lastReassessmentAt: validTimestamp(value.lastReassessmentAt),
  };
}
