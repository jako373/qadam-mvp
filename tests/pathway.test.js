import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculatePathway } from "../src/pathway.js";

const baseScores = {
  interactionScore: 5,
  understandingScore: 5,
  requestScore: 5,
  speechScore: 5,
  regulationScore: 5,
};

describe("calculatePathway", () => {
  it("prioritizes interaction when interaction is low", () => {
    assert.equal(calculatePathway({ ...baseScores, interactionScore: 2 }), "interaction");
  });

  it("prioritizes interaction when regulation is low", () => {
    assert.equal(calculatePathway({ ...baseScores, regulationScore: 2 }), "interaction");
  });

  it("returns understanding when understanding is low", () => {
    assert.equal(calculatePathway({ ...baseScores, understandingScore: 2 }), "understanding");
  });

  it("returns understanding when request score is low", () => {
    assert.equal(calculatePathway({ ...baseScores, requestScore: 2 }), "understanding");
  });

  it("returns firstWords when speech is at the boundary", () => {
    assert.equal(calculatePathway({ ...baseScores, speechScore: 3 }), "firstWords");
  });

  it("returns wordCombination when all scores are strong", () => {
    assert.equal(calculatePathway({ ...baseScores, speechScore: 4 }), "wordCombination");
  });
});
