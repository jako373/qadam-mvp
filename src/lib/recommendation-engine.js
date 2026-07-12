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

function repeatedThreeDays(adaptive, exerciseId, date) {
  const dates = recentPlanDates(adaptive, date, 3);
  return dates.length === 3 && dates.every((key) =>
    adaptive.dailyPlans[key]?.items?.some((item) => item.exerciseId === exerciseId),
  );
}

function lastOutcome(adaptive, exerciseId) {
  return [...adaptive.exerciseHistory]
    .reverse()
    .find((item) => item.exerciseId === exerciseId)?.outcome || null;
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

function categoryHadDifficulty(adaptive, category) {
  const last = [...adaptive.exerciseHistory].reverse().find((item) => item.category === category);
  return last?.outcome === "unable";
}

function candidatesFor(adaptive, exercises, category, selected, date, options = {}) {
  const currentLevel = Number(adaptive.skillLevels[category] || 1);
  const targetLevel = categoryHadDifficulty(adaptive, category)
    ? Math.max(1, currentLevel - 1)
    : currentLevel;
  const introduced = new Set(adaptive.introducedExerciseIds);
  let candidates = exercises.filter((exercise) => {
    if (!exercise.isActive || exercise.category !== category || selected.has(exercise.id)) return false;
    if (exercise.level > targetLevel) return false;
    if (repeatedThreeDays(adaptive, exercise.id, date)) return false;
    if (lastOutcome(adaptive, exercise.id) === "refused") return false;
    if (Number(adaptive.exerciseProgress[exercise.id]?.independentCount || 0) >= 2) return false;
    if (options.familiarOnly && !introduced.has(exercise.id)) return false;
    if (options.newOnly && introduced.has(exercise.id)) return false;
    return true;
  });

  candidates.sort((left, right) => {
    const exactLevel = Number(right.level === targetLevel) - Number(left.level === targetLevel);
    const attempts = Number(adaptive.exerciseProgress[right.id]?.attempts || 0) - Number(adaptive.exerciseProgress[left.id]?.attempts || 0);
    return exactLevel || attempts || left.id.localeCompare(right.id);
  });
  candidates = rotateForDate(candidates, date, `${category}:${options.familiarOnly ? "old" : "new"}`);
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
  const speechCategories = ["understanding", "communication"].sort((left, right) =>
    weakCategories.indexOf(left) - weakCategories.indexOf(right),
  );
  const slotCategories = [
    weakCategories,
    speechCategories,
    [...new Set([...strongCategories, "regulation"])],
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
      variant: categoryHadDifficulty(adaptive, exercise.category) ? "easier" : "standard",
    });
  }

  return {
    date,
    items,
    results: {},
    viewedCount: 0,
    completedAt: null,
  };
}

export function ensureDailyPlan(adaptive, exercises, date) {
  const prepared = ensureMinimumFamiliar(adaptive, exercises);
  const saved = prepared.dailyPlans[date];
  if (saved?.items?.length === 3) return { adaptive: prepared, plan: saved };

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
