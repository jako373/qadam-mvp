import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { exercises } from "../src/data/exercises.js";
import {
  exerciseIllustrationSpec,
  renderExerciseIllustration,
} from "../src/exercise-illustrations.js";

const adaptiveSource = readFileSync(new URL("../src/adaptive-flow.js", import.meta.url), "utf8");

describe("exercise illustrations", () => {
  it("renders an accessible illustration for every active exercise", () => {
    const active = exercises.filter((exercise) => exercise.isActive);
    assert.ok(active.length > 0);
    for (const exercise of active) {
      const markup = renderExerciseIllustration(exercise, "ru", (value) => String(value));
      assert.match(markup, new RegExp(`data-illustration-id="${exercise.id}"`));
      assert.match(markup, /<img src="\/public\/images\/exercises\/[a-z0-9-]+\.webp"/);
      assert.match(markup, /alt="Иллюстрация к упражнению/);
      assert.doesNotMatch(markup, /<svg\b/i);
    }
  });

  it("uses varied scenes while preserving one visual system", () => {
    const scenes = new Set(exercises.map((exercise) => exerciseIllustrationSpec(exercise).scene));
    assert.equal(scenes.size, 120);
    assert.equal(exercises.length, 120);
    assert.equal(new Set(exercises.map((exercise) => renderExerciseIllustration(exercise))).size, exercises.length);
    for (const scene of scenes) {
      assert.equal(existsSync(new URL(`../public/images/exercises/${scene}.webp`, import.meta.url)), true);
    }
  });

  it("places illustrations in the library, daily flow and exercise detail", () => {
    assert.match(adaptiveSource, /data-illustration-mount/);
    assert.match(adaptiveSource, /renderExerciseIllustration\(exercise, state\.language, escapeHtml\)/);
    assert.match(adaptiveSource, /mount\.outerHTML = renderExerciseIllustration/);
    assert.ok(adaptiveSource.match(/renderExerciseIllustration\(exercise, state\.language, escapeHtml\)/g).length >= 2);
  });
});
