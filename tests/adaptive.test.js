import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatPlanDate,
  handleAdaptiveClick,
  nextDailyRoute,
  planDayNumber,
  renderAdaptiveRoute,
} from "../src/adaptive-flow.js";
import { assessmentQuestions } from "../src/data/assessment-questions.js";
import { exerciseCategoryOrder } from "../src/data/exercise-localization.js";
import { exercises } from "../src/data/exercises.js";
import { createDefaultAdaptiveState, shiftDateKey } from "../src/lib/adaptive-state.js";
import {
  calculateSkillLevels,
  completeInitialAssessment,
  completionStreak,
  markDayCompleted,
  recordExerciseOutcome,
  skillProgressSnapshot,
} from "../src/lib/progress-engine.js";
import {
  adaptNextPlanItem,
  createDailyPlan,
  ensureDailyPlan,
  planDuration,
} from "../src/lib/recommendation-engine.js";

function answersByCategory(values) {
  return Object.fromEntries(
    assessmentQuestions.map((question) => [question.id, values[question.category]]),
  );
}

function assessedAdaptive(answer = 1) {
  const answers = Object.fromEntries(
    assessmentQuestions.map((question) => [question.id, answer]),
  );
  return completeInitialAssessment(
    createDefaultAdaptiveState(),
    answers,
    assessmentQuestions,
    exercises,
  );
}

describe("bilingual plan dates", () => {
  it("formats tomorrow without relying on optional browser locales", () => {
    assert.equal(formatPlanDate("2026-07-14", "kk"), "14 шілде, сейсенбі");
    assert.equal(formatPlanDate("2026-07-14", "ru"), "14 июля, вторник");
  });

  it("numbers the prepared plan from completed days", () => {
    const adaptive = createDefaultAdaptiveState();
    adaptive.completedDates = ["2026-07-13"];
    assert.equal(planDayNumber(adaptive, "2026-07-14"), 2);
  });
});

describe("completion streak", () => {
  it("keeps a streak only when the latest completion is today or yesterday", () => {
    const adaptive = createDefaultAdaptiveState();
    adaptive.completedDates = ["2026-07-10", "2026-07-11"];
    assert.equal(completionStreak(adaptive, new Date("2026-07-13T12:00:00")), 0);

    adaptive.completedDates.push("2026-07-12");
    assert.equal(completionStreak(adaptive, new Date("2026-07-13T12:00:00")), 3);
  });
});

describe("adaptive skill levels", () => {
  it("calculates every category independently", () => {
    const values = Object.fromEntries(
      exerciseCategoryOrder.map((category, index) => [category, index % 3]),
    );
    const levels = calculateSkillLevels(answersByCategory(values), assessmentQuestions);
    for (const category of exerciseCategoryOrder) {
      assert.equal(levels[category], values[category] + 1, category);
    }
  });

  it("does not change a level when a child refuses", () => {
    const adaptive = assessedAdaptive(1);
    const exercise = exercises.find(
      (item) => item.category === "understanding" && item.level === 2,
    );
    const before = adaptive.skillLevels.understanding;
    const next = recordExerciseOutcome(
      adaptive,
      exercise,
      "refused",
      "2026-07-13",
      exercises,
    );
    assert.equal(next.skillLevels.understanding, before);
    assert.equal(next.exerciseHistory.at(-1).score, null);
  });

  it("lowers a category after two unable outcomes", () => {
    let adaptive = assessedAdaptive(1);
    const exercise = exercises.find(
      (item) => item.category === "understanding" && item.level === 2,
    );
    adaptive = recordExerciseOutcome(adaptive, exercise, "unable", "2026-07-13", exercises);
    adaptive = recordExerciseOutcome(adaptive, exercise, "unable", "2026-07-14", exercises);
    assert.equal(adaptive.skillLevels.understanding, 1);
  });

  it("raises a category only after three exercises are mastered", () => {
    let adaptive = assessedAdaptive(1);
    const targets = exercises
      .filter((item) => item.category === "communication" && item.level === 2)
      .slice(0, 3);
    for (const exercise of targets) {
      adaptive = recordExerciseOutcome(adaptive, exercise, "independent", "2026-07-13", exercises);
      adaptive = recordExerciseOutcome(adaptive, exercise, "independent", "2026-07-14", exercises);
    }
    assert.equal(adaptive.skillLevels.communication, 3);
  });
});

describe("parent skill progress", () => {
  it("combines the current stage with mastered exercises", () => {
    const adaptive = assessedAdaptive(1);
    const targets = exercises
      .filter((item) => item.category === "communication" && item.level === 2)
      .slice(0, 2);
    for (const exercise of targets) {
      adaptive.exerciseProgress[exercise.id] = { independentCount: 2 };
    }
    const snapshot = skillProgressSnapshot(adaptive, "communication", exercises);
    assert.equal(snapshot.level, 2);
    assert.equal(snapshot.masteredAtCurrentLevel, 2);
    assert.equal(snapshot.progressPercent, 56);
  });

  it("shows the direction of recent results without comparing children", () => {
    const adaptive = assessedAdaptive(0);
    adaptive.exerciseHistory = [0, 0, 0, 2, 2, 2].map((score, index) => ({
      category: "understanding",
      exerciseId: `understanding-${index}`,
      outcome: score === 2 ? "independent" : "unable",
      score,
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    }));
    const snapshot = skillProgressSnapshot(adaptive, "understanding", exercises);
    assert.equal(snapshot.trend, "up");
    assert.equal(snapshot.attempts, 6);
    assert.equal(snapshot.independent, 3);
  });

  it("opens a skill explanation interactively", () => {
    let renders = 0;
    const event = {
      target: {
        closest: (selector) => selector === "[data-skill-progress]"
          ? { dataset: { skillProgress: "communication" } }
          : null,
      },
    };
    assert.equal(handleAdaptiveClick(event, { render: () => { renders += 1; } }), true);
    assert.equal(renders, 1);
  });

  it("renders an overall bar and one interactive bar for every skill", () => {
    const state = { language: "ru", adaptive: assessedAdaptive(1) };
    const html = renderAdaptiveRoute("/progress", {
      state,
      pageShell: (content) => content,
      escapeHtml: (value) => String(value),
      icon: (name) => `<i data-icon="${name}"></i>`,
    });
    assert.equal((html.match(/data-skill-progress=/g) || []).length, 8);
    assert.equal((html.match(/<progress /g) || []).length, 9);
    assert.match(html, /Карта развития/);
  });
});

describe("daily recommendation", () => {
  it("opens the prepared second day without searching the library", () => {
    const date = "2026-07-13";
    const tomorrow = shiftDateKey(date, 1);
    let adaptive = assessedAdaptive(1);
    const first = ensureDailyPlan(adaptive, exercises, date);
    adaptive = {
      ...first.adaptive,
      activePlanDate: date,
      dailyPlans: {
        ...first.adaptive.dailyPlans,
        [date]: { ...first.plan, completedAt: new Date().toISOString() },
      },
      completedDates: [date],
    };
    const second = ensureDailyPlan(adaptive, exercises, tomorrow);
    const state = { adaptive: second.adaptive };
    let route = "";
    const event = {
      target: {
        closest: (selector) => selector === "[data-open-plan-date]"
          ? { dataset: { openPlanDate: tomorrow } }
          : null,
      },
    };

    assert.equal(handleAdaptiveClick(event, {
      state,
      saveState: () => {},
      routeTo: (value) => { route = value; },
    }), true);
    assert.equal(state.adaptive.activePlanDate, tomorrow);
    assert.equal(route, "/daily/1");
  });

  it("asks for one result before opening the next exercise", () => {
    const plan = {
      items: ["first", "second", "third"].map((exerciseId) => ({ exerciseId })),
      results: {},
      viewedCount: 0,
      completedAt: null,
    };
    assert.equal(nextDailyRoute(plan), "/daily/1");
    plan.viewedCount = 1;
    assert.equal(nextDailyRoute(plan), "/daily-results/1");
    plan.results.first = "assisted";
    assert.equal(nextDailyRoute(plan), "/daily/2");
  });

  it("selects the next exercise immediately from the latest result", () => {
    const date = "2026-07-13";
    const catalogue = [
      { id: "source-level-2", category: "understanding", level: 2, isActive: true },
      { id: "easier-level-1", category: "understanding", level: 1, isActive: true },
      { id: "guided-level-2", category: "understanding", level: 2, isActive: true },
      { id: "progress-level-3", category: "understanding", level: 3, isActive: true },
      { id: "alternative-level-2", category: "communication", level: 2, isActive: true },
      { id: "reserved-level-2", category: "regulation", level: 2, isActive: true },
    ];
    const expected = {
      unable: ["easier-level-1", "easier"],
      assisted: ["guided-level-2", "guided"],
      independent: ["progress-level-3", "progress"],
      refused: ["alternative-level-2", "alternative"],
    };

    for (const [outcome, [exerciseId, variant]] of Object.entries(expected)) {
      const source = catalogue[0];
      let adaptive = createDefaultAdaptiveState();
      adaptive.skillLevels = Object.fromEntries(exerciseCategoryOrder.map((category) => [category, 2]));
      adaptive.introducedExerciseIds = catalogue.map((exercise) => exercise.id);
      adaptive.dailyPlans[date] = {
        date,
        basedOnDate: null,
        items: [source, catalogue[4], catalogue[5]].map((exercise) => ({
          exerciseId: exercise.id,
          isNew: false,
          variant: "balanced",
        })),
        results: {},
        viewedCount: 1,
        completedAt: null,
      };
      adaptive = recordExerciseOutcome(adaptive, source, outcome, date, catalogue);
      adaptive.dailyPlans[date] = {
        ...adaptive.dailyPlans[date],
        results: { [source.id]: outcome },
      };

      const adapted = adaptNextPlanItem(adaptive, catalogue, date, 1);
      assert.equal(adapted.plan.items[1].exerciseId, exerciseId, outcome);
      assert.equal(adapted.plan.items[1].variant, variant, outcome);
      assert.notEqual(adapted.plan.items[1].exerciseId, source.id, outcome);
    }
  });

  it("creates exactly three unique exercises, at most one new, within 15 minutes", () => {
    const adaptive = assessedAdaptive(1);
    const plan = createDailyPlan(adaptive, exercises, "2026-07-13");
    assert.equal(plan.items.length, 3);
    assert.equal(new Set(plan.items.map((item) => item.exerciseId)).size, 3);
    assert.ok(plan.items.filter((item) => item.isNew).length <= 1);
    assert.ok(planDuration(plan, exercises) <= 15);
  });

  it("keeps the same plan when the page is reopened", () => {
    const adaptive = assessedAdaptive(1);
    const first = ensureDailyPlan(adaptive, exercises, "2026-07-13");
    const second = ensureDailyPlan(first.adaptive, exercises, "2026-07-13");
    assert.deepEqual(second.plan, first.plan);
  });

  it("repairs stale familiar ids without allowing a second new exercise", () => {
    const adaptive = {
      ...assessedAdaptive(0),
      introducedExerciseIds: ["missing-01", "missing-02"],
    };
    const result = ensureDailyPlan(adaptive, exercises, "2026-07-13");
    assert.equal(result.plan.items.length, 3);
    assert.ok(result.plan.items.filter((item) => item.isNew).length <= 1);
  });

  it("does not immediately recommend an exercise that was refused", () => {
    let adaptive = assessedAdaptive(1);
    const first = ensureDailyPlan(adaptive, exercises, "2026-07-13");
    adaptive = first.adaptive;
    const refusedId = first.plan.items[0].exerciseId;
    const refused = exercises.find((exercise) => exercise.id === refusedId);
    adaptive = recordExerciseOutcome(
      adaptive,
      refused,
      "refused",
      "2026-07-13",
      exercises,
    );
    const next = createDailyPlan(adaptive, exercises, "2026-07-14");
    assert.ok(!next.items.some((item) => item.exerciseId === refusedId));
  });

  it("does not repeat one exercise for a fourth consecutive day", () => {
    let adaptive = assessedAdaptive(1);
    const plans = [];
    for (const date of ["2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13"]) {
      const result = ensureDailyPlan(adaptive, exercises, date);
      adaptive = result.adaptive;
      plans.push(result.plan);
    }
    const firstThreeCommon = plans[0].items
      .map((item) => item.exerciseId)
      .filter((id) => plans[1].items.some((item) => item.exerciseId === id))
      .filter((id) => plans[2].items.some((item) => item.exerciseId === id));
    for (const id of firstThreeCommon) {
      assert.ok(!plans[3].items.some((item) => item.exerciseId === id), id);
    }
  });

  it("builds tomorrow's plan from the child's three latest outcomes", () => {
    const date = "2026-07-13";
    const tomorrow = shiftDateKey(date, 1);
    const selected = [
      exercises.find((item) => item.category === "understanding" && item.level === 2),
      exercises.find((item) => item.category === "communication" && item.level === 2),
      exercises.find((item) => item.category === "imitation" && item.level === 2),
    ];
    const outcomes = ["unable", "assisted", "independent"];
    let adaptive = {
      ...assessedAdaptive(1),
      introducedExerciseIds: selected.map((exercise) => exercise.id),
      dailyPlans: {
        [date]: {
          date,
          items: selected.map((exercise) => ({ exerciseId: exercise.id, isNew: false, variant: "balanced" })),
          results: {},
          viewedCount: 3,
          completedAt: null,
        },
      },
    };

    selected.forEach((exercise, index) => {
      adaptive = recordExerciseOutcome(adaptive, exercise, outcomes[index], date, exercises);
      adaptive.dailyPlans[date].results[exercise.id] = outcomes[index];
    });
    adaptive = markDayCompleted(adaptive, date);

    const next = ensureDailyPlan(adaptive, exercises, tomorrow);
    const nextExercises = next.plan.items.map((item) => ({
      ...item,
      exercise: exercises.find((exercise) => exercise.id === item.exerciseId),
    }));
    assert.equal(next.plan.basedOnDate, date);
    assert.equal(next.plan.date, tomorrow);
    assert.ok(nextExercises.some((item) => item.exercise.category === "understanding" && item.variant === "easier"));
    assert.ok(nextExercises.some((item) => item.exercise.category === "communication" && item.variant === "guided"));
    assert.ok(nextExercises.some((item) => item.exercise.category === "imitation" && item.variant === "progress"));
    assert.ok(nextExercises.find((item) => item.exercise.category === "understanding").exercise.level <= 1);
  });
});
