import { exerciseCategoryOrder } from "../data/exercise-localization.js";

export const exerciseOutcomes = ["independent", "assisted", "unable", "refused"];

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    dailyPlans: {},
    completedDates: [],
    lastReassessmentAt: null,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  const answers = isRecord(initialAssessment.answers) ? initialAssessment.answers : {};
  const reassessment = isRecord(value.reassessment) ? value.reassessment : {};
  const reassessmentAnswers = isRecord(reassessment.answers) ? reassessment.answers : {};
  const skillLevels = createDefaultSkillLevels();
  if (isRecord(value.skillLevels)) {
    for (const category of exerciseCategoryOrder) {
      skillLevels[category] = validLevel(value.skillLevels[category]);
    }
  }

  const exerciseProgress = isRecord(value.exerciseProgress)
    ? Object.fromEntries(Object.entries(value.exerciseProgress).filter(([, item]) => isRecord(item)))
    : {};
  const dailyPlans = isRecord(value.dailyPlans)
    ? Object.fromEntries(Object.entries(value.dailyPlans).filter(([, item]) => isRecord(item)))
    : {};
  const history = Array.isArray(value.exerciseHistory)
    ? value.exerciseHistory.filter((item) => isRecord(item) && typeof item.exerciseId === "string")
    : [];

  return {
    initialAssessment: {
      answers,
      completedAt:
        typeof initialAssessment.completedAt === "string" ? initialAssessment.completedAt : null,
    },
    reassessment: {
      answers: reassessmentAnswers,
      startedAt: typeof reassessment.startedAt === "string" ? reassessment.startedAt : null,
    },
    skillLevels,
    exerciseProgress,
    exerciseHistory: history.slice(-500),
    introducedExerciseIds: uniqueStrings(value.introducedExerciseIds),
    favoriteExerciseIds: uniqueStrings(value.favoriteExerciseIds),
    dailyPlans,
    completedDates: uniqueStrings(value.completedDates).sort(),
    lastReassessmentAt:
      typeof value.lastReassessmentAt === "string" ? value.lastReassessmentAt : null,
  };
}
