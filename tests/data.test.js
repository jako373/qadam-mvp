import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getLesson2Activities, getNextLessonId, lessonOrder, lessons, ui } from "../src/data.js";

const languages = ["kk", "ru"];
const pathways = ["interaction", "understanding", "firstWords", "wordCombination"];

describe("lesson content", () => {
  it("contains exactly 12 ordered lessons", () => {
    assert.deepEqual(
      lessonOrder,
      Array.from({ length: 12 }, (_, index) => `lesson${index + 1}`),
    );
    assert.equal(Object.keys(lessons).length, 12);
  });

  it("uses four activities and the planned 15/16/17 minute schedule", () => {
    lessonOrder.forEach((lessonId, index) => {
      const lesson = lessons[lessonId];
      const expectedDuration = index < 4 ? 15 : index < 8 ? 16 : 17;
      assert.equal(lesson.duration, expectedDuration, lessonId);
      assert.equal(lesson.activities.length, 4, lessonId);
      assert.equal(
        lesson.activities.reduce((sum, activity) => sum + activity.duration, 0),
        expectedDuration,
        `${lessonId} activity duration`,
      );
    });
  });

  it("provides complete parent guidance in both languages", () => {
    for (const lessonId of lessonOrder) {
      const lesson = lessons[lessonId];
      for (const language of languages) {
        const copy = lesson[language];
        for (const field of ["title", "description", "prep", "objectsUse", "repeatPlan"]) {
          assert.ok(copy[field], `${lessonId}.${language}.${field}`);
        }
      }
      for (const activity of lesson.activities) {
        for (const language of languages) {
          const copy = activity[language];
          assert.ok(copy.title, `${activity.id}.${language}.title`);
          assert.ok(copy.prep, `${activity.id}.${language}.prep`);
          assert.ok(copy.steps.length >= 3, `${activity.id}.${language}.steps`);
          assert.ok(copy.benefit.length >= 2, `${activity.id}.${language}.benefit`);
        }
      }
    }
  });

  it("keeps four 15-minute adaptive variants for lesson 2", () => {
    for (const pathway of pathways) {
      const activities = getLesson2Activities("lesson2", pathway);
      assert.equal(activities.length, 4, pathway);
      assert.equal(
        activities.reduce((sum, activity) => sum + activity.duration, 0),
        15,
        pathway,
      );
      assert.equal(new Set(activities.map((activity) => activity.id)).size, 4, pathway);
    }
  });

  it("returns the next lesson without passing lesson 12", () => {
    assert.equal(getNextLessonId("lesson1"), "lesson2");
    assert.equal(getNextLessonId("lesson12"), null);
    assert.equal(getNextLessonId("unknown"), null);
  });

  it("keeps Kazakh and Russian interface keys aligned", () => {
    assert.deepEqual(Object.keys(ui.kk).sort(), Object.keys(ui.ru).sort());
  });
});
