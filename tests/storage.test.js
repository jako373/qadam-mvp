import { beforeEach, describe, expect, it } from "vitest";

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
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

describe("storage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
  });

  it("loads the default state when nothing is saved", () => {
    expect(loadState()).toEqual(createDefaultState());
  });

  it("merges saved progress with defaults", () => {
    saveState({
      language: "ru",
      progress: {
        onboardingCompleted: true,
        completedLessonIds: ["lesson1"],
      },
    });

    expect(loadState().progress).toMatchObject({
      onboardingCompleted: true,
      parentIntroCompleted: false,
      completedLessonIds: ["lesson1"],
      unlockedLessonIds: ["lesson1"],
    });
  });

  it("falls back to defaults when saved state is corrupted", () => {
    localStorage.setItem("qadam.mvp.state.v1", "{broken");

    expect(loadState()).toEqual(createDefaultState());
  });

  it("saves and clears timers", () => {
    saveTimers({ lesson1: { remainingWhenPaused: 12 } });

    expect(loadTimers()).toEqual({ lesson1: { remainingWhenPaused: 12 } });

    resetState();

    expect(loadTimers()).toEqual({});
  });
});
