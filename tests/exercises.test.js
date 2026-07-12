import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { exerciseCategoryOrder } from "../src/data/exercise-localization.js";
import { exercises, getExerciseById } from "../src/data/exercises.js";

describe("120 exercise catalogue", () => {
  it("contains 120 unique active exercises", () => {
    assert.equal(exercises.length, 120);
    assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, 120);
    assert.ok(exercises.every((exercise) => exercise.isActive));
  });

  it("contains 15 exercises and five exercises per level in every category", () => {
    for (const category of exerciseCategoryOrder) {
      const categoryExercises = exercises.filter((exercise) => exercise.category === category);
      assert.equal(categoryExercises.length, 15, category);
      for (const level of [1, 2, 3]) {
        assert.equal(
          categoryExercises.filter((exercise) => exercise.level === level).length,
          5,
          `${category} level ${level}`,
        );
      }
    }
  });

  it("provides a complete parent-readable structure in Kazakh and Russian", () => {
    for (const exercise of exercises) {
      assert.equal(getExerciseById(exercise.id), exercise);
      assert.ok(exercise.durationMinutes >= 3 && exercise.durationMinutes <= 5, exercise.id);
      for (const language of ["kk", "ru"]) {
        const copy = exercise[language];
        for (const field of [
          "title",
          "goal",
          "successCriteria",
          "easierVersion",
          "harderVersion",
          "parentTip",
        ]) {
          assert.ok(copy[field]?.trim(), `${exercise.id}.${language}.${field}`);
        }
        assert.ok(copy.materials.length >= 1, `${exercise.id}.${language}.materials`);
        assert.equal(copy.steps.length, 3, `${exercise.id}.${language}.steps`);
        assert.ok(copy.steps.every((step) => step.trim()), `${exercise.id}.${language}.steps`);
      }
    }
  });
});
