import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  createDefaultState,
  loadState,
  loadTimers,
  resetState,
  saveState,
  saveTimers,
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

  it("creates independent default arrays", () => {
    const first = createDefaultState();
    const second = createDefaultState();
    first.progress.unlockedLessonIds.push("lesson2");
    assert.deepEqual(second.progress.unlockedLessonIds, ["lesson1"]);
  });

  it("loads the default state when nothing is saved", () => {
    assert.deepEqual(loadState(), createDefaultState());
  });

  it("merges saved progress with defaults", () => {
    saveState({
      language: "ru",
      progress: { onboardingCompleted: true, completedLessonIds: ["lesson1"] },
    });
    const progress = loadState().progress;
    assert.equal(progress.onboardingCompleted, true);
    assert.equal(progress.parentIntroCompleted, false);
    assert.deepEqual(progress.completedLessonIds, ["lesson1"]);
    assert.deepEqual(progress.unlockedLessonIds, ["lesson1"]);
  });

  it("sanitizes malformed saved values", () => {
    saveState({
      language: "unsupported",
      childProfile: [],
      progress: { completedLessonIds: "lesson1", unlockedLessonIds: ["lesson1", 2] },
      assessments: { lesson1: null },
    });
    const state = loadState();
    assert.equal(state.language, "kk");
    assert.equal(state.childProfile, null);
    assert.deepEqual(state.progress.completedLessonIds, []);
    assert.deepEqual(state.progress.unlockedLessonIds, ["lesson1"]);
    assert.deepEqual(state.assessments, {});
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

  it("saves and clears timers", () => {
    saveTimers({ lesson1: { remainingWhenPaused: 12 } });
    assert.deepEqual(loadTimers(), { lesson1: { remainingWhenPaused: 12 } });
    resetState();
    assert.deepEqual(loadTimers(), {});
  });
});
