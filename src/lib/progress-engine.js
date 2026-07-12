import { exerciseCategoryOrder } from "../data/exercise-localization.js";

const outcomeScores = {
  independent: 2,
  assisted: 1,
  unable: 0,
  refused: null,
};

function clampLevel(value) {
  return Math.max(1, Math.min(3, Number(value) || 1));
}

export function calculateSkillLevels(answers, questions) {
  const levels = {};
  for (const category of exerciseCategoryOrder) {
    const categoryQuestions = questions.filter((question) => question.category === category);
    const known = categoryQuestions
      .map((question) => answers[question.id])
      .filter((value) => value === 0 || value === 1 || value === 2);
    if (!known.length) {
      levels[category] = 1;
      continue;
    }
    const normalizedScore = (known.reduce((sum, value) => sum + value, 0) * 2) / known.length;
    levels[category] = normalizedScore <= 1 ? 1 : normalizedScore < 4 ? 2 : 3;
  }
  return levels;
}

export function seedFamiliarExercises(skillLevels, exercises) {
  const seedCategories = ["understanding", "regulation"];
  return seedCategories
    .map((category) =>
      exercises.find(
        (exercise) =>
          exercise.category === category &&
          exercise.level <= clampLevel(skillLevels[category]) &&
          exercise.isActive,
      ),
    )
    .filter(Boolean)
    .map((exercise) => exercise.id);
}

export function completeInitialAssessment(adaptive, answers, questions, exercises) {
  const skillLevels = calculateSkillLevels(answers, questions);
  return {
    ...adaptive,
    initialAssessment: {
      answers: { ...answers },
      completedAt: new Date().toISOString(),
    },
    skillLevels,
    introducedExerciseIds: [
      ...new Set([...adaptive.introducedExerciseIds, ...seedFamiliarExercises(skillLevels, exercises)]),
    ],
  };
}

function masteredAtLevel(adaptive, exercises, category, level) {
  return exercises.filter((exercise) => {
    if (exercise.category !== category || exercise.level !== level) return false;
    return Number(adaptive.exerciseProgress[exercise.id]?.independentCount || 0) >= 2;
  }).length;
}

export function recordExerciseOutcome(adaptive, exercise, outcome, date, exercises) {
  if (!Object.hasOwn(outcomeScores, outcome)) return adaptive;

  const previous = adaptive.exerciseProgress[exercise.id] || {
    independentCount: 0,
    unableStreak: 0,
    attempts: 0,
    lastOutcome: null,
  };
  const progress = { ...previous, attempts: Number(previous.attempts || 0) + 1 };

  if (outcome === "independent") {
    progress.independentCount = Number(previous.independentCount || 0) + 1;
    progress.unableStreak = 0;
  } else if (outcome === "unable") {
    progress.unableStreak = Number(previous.unableStreak || 0) + 1;
  } else if (outcome === "assisted") {
    progress.unableStreak = 0;
  }
  progress.lastOutcome = outcome;
  progress.lastDate = date;

  const next = {
    ...adaptive,
    skillLevels: { ...adaptive.skillLevels },
    exerciseProgress: { ...adaptive.exerciseProgress, [exercise.id]: progress },
    exerciseHistory: [
      ...adaptive.exerciseHistory,
      {
        exerciseId: exercise.id,
        category: exercise.category,
        level: exercise.level,
        outcome,
        score: outcomeScores[outcome],
        date,
        at: new Date().toISOString(),
      },
    ].slice(-500),
    introducedExerciseIds: [...new Set([...adaptive.introducedExerciseIds, exercise.id])],
  };

  const currentLevel = clampLevel(next.skillLevels[exercise.category]);
  if (outcome === "unable" && progress.unableStreak >= 2) {
    next.skillLevels[exercise.category] = clampLevel(currentLevel - 1);
    next.exerciseProgress[exercise.id] = { ...progress, unableStreak: 0 };
  } else if (
    outcome === "independent" &&
    exercise.level === currentLevel &&
    masteredAtLevel(next, exercises, exercise.category, currentLevel) >= 3
  ) {
    next.skillLevels[exercise.category] = clampLevel(currentLevel + 1);
  }

  return next;
}

export function markDayCompleted(adaptive, date) {
  const plan = adaptive.dailyPlans[date];
  return {
    ...adaptive,
    completedDates: [...new Set([...adaptive.completedDates, date])].sort(),
    dailyPlans: {
      ...adaptive.dailyPlans,
      [date]: { ...plan, completedAt: plan?.completedAt || new Date().toISOString() },
    },
  };
}

export function weeklySummary(adaptive, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const history = adaptive.exerciseHistory.filter((item) => item.date >= startKey);
  const mastered = new Set(
    history
      .filter((item) => adaptive.exerciseProgress[item.exerciseId]?.independentCount >= 2)
      .map((item) => item.exerciseId),
  );
  return {
    completed: history.length,
    independent: history.filter((item) => item.outcome === "independent").length,
    assisted: history.filter((item) => item.outcome === "assisted").length,
    newSkills: mastered.size,
  };
}

export function completionStreak(adaptive) {
  const dates = [...new Set(adaptive.completedDates)].sort().reverse();
  if (!dates.length) return 0;
  let streak = 1;
  let previous = new Date(`${dates[0]}T12:00:00`);
  for (let index = 1; index < dates.length; index += 1) {
    const current = new Date(`${dates[index]}T12:00:00`);
    const gap = Math.round((previous - current) / 86400000);
    if (gap !== 1) break;
    streak += 1;
    previous = current;
  }
  return streak;
}

export function isReassessmentDue(adaptive, now = new Date()) {
  const baseline = adaptive.lastReassessmentAt || adaptive.initialAssessment.completedAt;
  if (!baseline) return false;
  return now.getTime() - new Date(baseline).getTime() >= 14 * 86400000;
}

export function skillStatus(level, language) {
  const labels = {
    kk: ["Бастап жатыр", "Дамып келеді", "Сенімді орындап жүр"],
    ru: ["Начинает", "Развивается", "Выполняет увереннее"],
  };
  return labels[language][clampLevel(level) - 1];
}

export function outcomeMessage(outcome, language) {
  const messages = {
    independent: { kk: "Жақсы қадам!", ru: "Отличный шаг!" },
    assisted: {
      kk: "Көмекпен орындауы да - нәтиже",
      ru: "Выполнение с помощью - тоже результат",
    },
    unable: {
      kk: "Келесіде жеңіл нұсқасын ұсынамыз",
      ru: "В следующий раз предложим более лёгкий вариант",
    },
    refused: {
      kk: "Қысым жасамай, басқа жаттығуға өтеміз",
      ru: "Без давления перейдём к другому упражнению",
    },
  };
  return messages[outcome]?.[language] || "";
}
