import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessmentQuestions } from "../src/data/assessment-questions.js";
import { exerciseCategoryOrder } from "../src/data/exercise-localization.js";

describe("initial skill questions", () => {
  it("contains two questions for every skill direction", () => {
    assert.equal(assessmentQuestions.length, 16);
    for (const category of exerciseCategoryOrder) {
      assert.equal(assessmentQuestions.filter((question) => question.category === category).length, 2, category);
    }
  });

  it("uses four question-specific bilingual answers", () => {
    const optionSets = [];
    for (const question of assessmentQuestions) {
      assert.deepEqual(question.answers.map((answer) => answer.value), [2, 1, 0, null]);
      for (const language of ["kk", "ru"]) {
        const labels = question.answers.map((answer) => answer[language]);
        assert.equal(new Set(labels).size, 4, `${question.id}.${language}`);
        assert.ok(labels.every((label) => label.trim().length >= 10), `${question.id}.${language}`);
      }
      optionSets.push(question.answers.map((answer) => answer.kk).join("|"));
    }
    assert.equal(new Set(optionSets).size, 16);
  });
});
