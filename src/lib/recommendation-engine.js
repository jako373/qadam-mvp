import { exerciseCategoryOrder } from "../data/exercise-localization.js";

function scoreForCategory(adaptive, category) {
  const history = adaptive.exerciseHistory
    .filter((item) => item.category === category && item.score !== null)
    .slice(-6);
  if (!history.length) return 1;
  return history.reduce((sum, item) => sum + Number(item.score || 0), 0) / history.length;
}

function categoryRank(adaptive, direction = "weak") {
  return [...exerciseCategoryOrder].sort((left, right) => {
    const levelDifference = Number(adaptive.skillLevels[left]) - Number(adaptive.skillLevels[right]);
    const scoreDifference = scoreForCategory(adaptive, left) - scoreForCategory(adaptive, right);
    return direction === "weak"
      ? levelDifference || scoreDifference || exerciseCategoryOrder.indexOf(left) - exerciseCategoryOrder.indexOf(right)
      : -levelDifference || -scoreDifference || exerciseCategoryOrder.indexOf(left) - exerciseCategoryOrder.indexOf(right);
  });
}

function recentPlanDates(adaptive, date, count = 3) {
  return Object.keys(adaptive.dailyPlans)
    .filter((key) => key < date)
    .sort()
    .slice(-count);
}

function latestCompletedPlan(adaptive, date) {
  const key = Object.keys(adaptive.dailyPlans)
    .filter((planDate) => planDate < date && adaptive.dailyPlans[planDate]?.completedAt)
    .sort()
    .at(-1);
  return key ? adaptive.dailyPlans[key] : null;
}

function repeatedThreeDays(adaptive, exerciseId, date) {
  const dates = recentPlanDates(adaptive, date, 3);
  return dates.length === 3 && dates.every((key) =>
    adaptive.dailyPlans[key]?.items?.some((item) => item.exerciseId === exerciseId),
  );
}

function lastAttempt(adaptive, exerciseId) {
  return [...adaptive.exerciseHistory]
    .reverse()
    .find((item) => item.exerciseId === exerciseId) || null;
}

function recentlyRefused(adaptive, exerciseId, date) {
  const attempt = lastAttempt(adaptive, exerciseId);
  if (attempt?.outcome !== "refused") return false;
  return recentPlanDates(adaptive, date, 3).includes(attempt.date);
}

function dateHash(value) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

function rotateForDate(items, date, salt) {
  if (!items.length) return items;
  const offset = dateHash(`${date}:${salt}`) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function recentCategoryAttempt(adaptive, category) {
  return [...adaptive.exerciseHistory].reverse().find((item) => item.category === category) || null;
}

function targetLevelFor(adaptive, category) {
  const currentLevel = Number(adaptive.skillLevels[category] || 1);
  const recent = recentCategoryAttempt(adaptive, category);
  if (recent?.outcome === "unable") {
    return Math.max(1, Math.min(currentLevel, Number(recent.level || currentLevel) - 1));
  }
  return currentLevel;
}

function itemReason(adaptive, category) {
  const outcome = recentCategoryAttempt(adaptive, category)?.outcome;
  if (outcome === "unable") return "easier";
  if (outcome === "assisted") return "guided";
  if (outcome === "independent") return "progress";
  if (outcome === "refused") return "alternative";
  return "balanced";
}

function resultPriorityCategories(adaptive, exercises, date) {
  const latest = latestCompletedPlan(adaptive, date);
  if (!latest) return [];
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const order = { unable: 0, assisted: 1, independent: 2, refused: 3 };
  return latest.items
    .map((item, index) => ({
      category: byId.get(item.exerciseId)?.category,
      outcome: latest.results?.[item.exerciseId],
      index,
    }))
    .filter((item) => item.category && Object.hasOwn(order, item.outcome))
    .sort((left, right) => order[left.outcome] - order[right.outcome] || left.index - right.index)
    .map((item) => item.category)
    .filter((category, index, list) => list.indexOf(category) === index);
}

function candidatesFor(adaptive, exercises, category, selected, date, options = {}) {
  const targetLevel = targetLevelFor(adaptive, category);
  const introduced = new Set(adaptive.introducedExerciseIds);
  let candidates = exercises.filter((exercise) => {
    if (!exercise.isActive || exercise.category !== category || selected.has(exercise.id)) return false;
    if (exercise.level > targetLevel) return false;
    if (repeatedThreeDays(adaptive, exercise.id, date)) return false;
    if (recentlyRefused(adaptive, exercise.id, date)) return false;
    if (Number(adaptive.exerciseProgress[exercise.id]?.independentCount || 0) >= 2) return false;
    if (options.familiarOnly && !introduced.has(exercise.id)) return false;
    if (options.newOnly && introduced.has(exercise.id)) return false;
    return true;
  });

  candidates.sort((left, right) => {
    const exactLevel = Number(right.level === targetLevel) - Number(left.level === targetLevel);
    const attempts = Number(adaptive.exerciseProgress[left.id]?.attempts || 0) - Number(adaptive.exerciseProgress[right.id]?.attempts || 0);
    const independent = Number(adaptive.exerciseProgress[left.id]?.independentCount || 0) - Number(adaptive.exerciseProgress[right.id]?.independentCount || 0);
    const tieBreak = dateHash(`${date}:${left.id}`) - dateHash(`${date}:${right.id}`);
    return exactLevel || attempts || independent || tieBreak || left.id.localeCompare(right.id);
  });
  return candidates;
}

function firstAvailable(adaptive, exercises, categories, selected, date, options) {
  for (const category of categories) {
    const candidate = candidatesFor(adaptive, exercises, category, selected, date, options)[0];
    if (candidate) return candidate;
  }
  return null;
}

function relaxedFamiliar(adaptive, exercises, categories, selected, date) {
  const introduced = new Set(adaptive.introducedExerciseIds);
  for (const category of categories) {
    const currentLevel = Number(adaptive.skillLevels[category] || 1);
    const candidate = rotateForDate(
      exercises.filter(
        (exercise) =>
          exercise.isActive &&
          exercise.category === category &&
          exercise.level <= currentLevel &&
          introduced.has(exercise.id) &&
          !selected.has(exercise.id),
      ),
      date,
      `${category}:relaxed`,
    )[0];
    if (candidate) return candidate;
  }
  return null;
}

function ensureMinimumFamiliar(adaptive, exercises) {
  const introduced = new Set(adaptive.introducedExerciseIds);
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  let eligibleCount = [...introduced].filter((id) => {
    const exercise = byId.get(id);
    return (
      exercise?.isActive &&
      exercise.level <= Number(adaptive.skillLevels[exercise.category] || 1)
    );
  }).length;
  if (eligibleCount >= 2) return adaptive;
  const preferredCategories = ["understanding", "regulation", ...exerciseCategoryOrder];
  for (const category of preferredCategories) {
    const exercise = exercises.find(
      (item) =>
        item.isActive &&
        item.category === category &&
        item.level <= Number(adaptive.skillLevels[category] || 1) &&
        !introduced.has(item.id),
    );
    if (exercise) {
      introduced.add(exercise.id);
      eligibleCount += 1;
    }
    if (eligibleCount >= 2) break;
  }
  return {
    ...adaptive,
    introducedExerciseIds: [...introduced],
  };
}

export function createDailyPlan(adaptive, exercises, date) {
  adaptive = ensureMinimumFamiliar(adaptive, exercises);
  const weakCategories = categoryRank(adaptive, "weak");
  const strongCategories = categoryRank(adaptive, "strong");
  const resultCategories = resultPriorityCategories(adaptive, exercises, date);
  const speechCategories = ["understanding", "communication"].sort((left, right) =>
    weakCategories.indexOf(left) - weakCategories.indexOf(right),
  );
  const slotCategories = [
    [...new Set([resultCategories[0], ...weakCategories].filter(Boolean))],
    [...new Set([resultCategories[1], ...speechCategories, ...weakCategories].filter(Boolean))],
    [...new Set([resultCategories[2], ...strongCategories, "regulation"].filter(Boolean))],
  ];

  const introduced = new Set(adaptive.introducedExerciseIds);
  const selected = new Set();
  const items = [];
  let newCount = 0;

  for (let slot = 0; slot < 3; slot += 1) {
    const categories = slotCategories[slot];
    let exercise = null;

    if (slot === 0 && newCount === 0) {
      exercise = firstAvailable(adaptive, exercises, categories, selected, date, { newOnly: true });
    }
    if (!exercise) {
      exercise = firstAvailable(adaptive, exercises, categories, selected, date, { familiarOnly: true });
    }
    if (!exercise && newCount === 0) {
      exercise = firstAvailable(adaptive, exercises, categories, selected, date, { newOnly: true });
    }
    if (!exercise) {
      exercise = firstAvailable(adaptive, exercises, exerciseCategoryOrder, selected, date, { familiarOnly: true });
    }
    if (!exercise && newCount === 0) {
      exercise = firstAvailable(adaptive, exercises, exerciseCategoryOrder, selected, date, { newOnly: true });
    }
    if (!exercise && newCount > 0) {
      exercise = relaxedFamiliar(adaptive, exercises, exerciseCategoryOrder, selected, date);
    }
    if (!exercise && newCount === 0) {
      exercise = exercises.find((item) => item.isActive && !selected.has(item.id));
    }
    if (!exercise) throw new Error("Not enough active exercises to create a daily plan");

    const isNew = !introduced.has(exercise.id);
    if (isNew) newCount += 1;
    selected.add(exercise.id);
    items.push({
      exerciseId: exercise.id,
      isNew,
      variant: itemReason(adaptive, exercise.category),
    });
  }

  const basis = latestCompletedPlan(adaptive, date);
  return {
    date,
    basedOnDate: basis?.date || null,
    items,
    results: {},
    viewedCount: 0,
    completedAt: null,
  };
}

export function ensureDailyPlan(adaptive, exercises, date) {
  const prepared = ensureMinimumFamiliar(adaptive, exercises);
  const saved = prepared.dailyPlans[date];
  const activeIds = new Set(exercises.filter((exercise) => exercise.isActive).map((exercise) => exercise.id));
  const validSaved =
    saved?.items?.length === 3 &&
    new Set(saved.items.map((item) => item.exerciseId)).size === 3 &&
    saved.items.every((item) => activeIds.has(item.exerciseId));
  if (validSaved) return { adaptive: prepared, plan: saved };

  const plan = createDailyPlan(prepared, exercises, date);
  return {
    adaptive: {
      ...prepared,
      introducedExerciseIds: [
        ...new Set([...prepared.introducedExerciseIds, ...plan.items.map((item) => item.exerciseId)]),
      ],
      dailyPlans: { ...prepared.dailyPlans, [date]: plan },
    },
    plan,
  };
}

export function planDuration(plan, exercises) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return plan.items.reduce(
    (sum, item) => sum + Number(byId.get(item.exerciseId)?.durationMinutes || 0),
    0,
  );
}
