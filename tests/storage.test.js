import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  createDefaultState,
  loadState,
  resetState,
  saveState,
} from "../src/storage.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe("storage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
    resetState();
  });

  it("creates independent adaptive collections", () => {
    const first = createDefaultState();
    const second = createDefaultState();
    first.adaptive.completedDates.push("2026-07-13");
    assert.deepEqual(second.adaptive.completedDates, []);
  });

  it("loads the default state when nothing is saved", () => {
    assert.deepEqual(loadState(), createDefaultState());
  });

  it("keeps only the current onboarding progress shape", () => {
    saveState({
      language: "ru",
      progress: {
        onboardingCompleted: true,
        completedLessonIds: ["lesson1"],
        unlockedLessonIds: ["lesson1", "lesson2"],
      },
    });
    assert.deepEqual(loadState().progress, { onboardingCompleted: true });
    assert.ok(!Object.hasOwn(loadState(), "assessments"));
    assert.ok(!Object.hasOwn(loadState(), "activityChecks"));
  });

  it("sanitizes malformed saved values", () => {
    saveState({
      language: "unsupported",
      childProfile: [],
      progress: { onboardingCompleted: "yes" },
      adaptive: { dailyPlans: [] },
    });
    const state = loadState();
    assert.equal(state.language, "kk");
    assert.equal(state.childProfile, null);
    assert.deepEqual(state.progress, { onboardingCompleted: false });
    assert.deepEqual(state.adaptive.dailyPlans, {});
  });

  it("repairs malformed nested adaptive values", () => {
    saveState({
      ...createDefaultState(),
      adaptive: {
        activePlanDate: "invalid",
        initialAssessment: {
          answers: { valid: 2, unknown: null, invalid: "2" },
          completedAt: "not-a-date",
        },
        exerciseProgress: {
          "understanding-01": {
            independentCount: -4,
            unableStreak: "2",
            attempts: 999999,
            lastOutcome: "wrong",
            lastDate: "2026-99-40",
          },
        },
        dailyPlans: {
          invalid: { items: [] },
          "2026-07-13": {
            items: [{ exerciseId: "understanding-01", isNew: true, variant: "unknown" }],
            results: null,
            viewedCount: 99,
            completedAt: 42,
          },
        },
        completedDates: ["2026-07-13", "not-a-date"],
      },
    });

    const adaptive = loadState().adaptive;
    assert.deepEqual(adaptive.initialAssessment.answers, { valid: 2, unknown: null });
    assert.equal(adaptive.initialAssessment.completedAt, null);
    assert.deepEqual(adaptive.completedDates, ["2026-07-13"]);
    assert.equal(adaptive.activePlanDate, null);
    assert.equal(adaptive.exerciseProgress["understanding-01"].independentCount, 0);
    assert.equal(adaptive.exerciseProgress["understanding-01"].unableStreak, 2);
    assert.equal(adaptive.exerciseProgress["understanding-01"].attempts, 10000);
    assert.equal(adaptive.exerciseProgress["understanding-01"].lastOutcome, null);
    assert.equal(adaptive.dailyPlans["2026-07-13"].viewedCount, 3);
    assert.deepEqual(adaptive.dailyPlans["2026-07-13"].results, {});
    assert.equal(adaptive.dailyPlans["2026-07-13"].items[0].variant, "balanced");
    assert.ok(!Object.hasOwn(adaptive.dailyPlans, "invalid"));
  });

  it("falls back to defaults when saved JSON is corrupted", () => {
    localStorage.setItem("qadam.mvp.state.v1", "{broken");
    assert.deepEqual(loadState(), createDefaultState());
  });

  it("keeps the current session usable when browser storage is blocked", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
        removeItem() {
          throw new Error("blocked");
        },
      },
      configurable: true,
    });
    saveState({ ...createDefaultState(), language: "ru" });
    assert.equal(loadState().language, "ru");
  });
});
