import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessmentQuestions } from "../src/data/assessment-questions.js";
import { exerciseCategoryOrder } from "../src/data/exercise-localization.js";
import { exercises } from "../src/data/exercises.js";
import { createDefaultAdaptiveState } from "../src/lib/adaptive-state.js";
import {
  calculateSkillLevels,
  completeInitialAssessment,
  recordExerciseOutcome,
} from "../src/lib/progress-engine.js";
import {
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

describe("daily recommendation", () => {
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
});
