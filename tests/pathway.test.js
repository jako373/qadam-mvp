import { describe, expect, it } from "vitest";

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
    expect(calculatePathway({ ...baseScores, interactionScore: 2 })).toBe("interaction");
  });

  it("prioritizes interaction when regulation is low", () => {
    expect(calculatePathway({ ...baseScores, regulationScore: 2 })).toBe("interaction");
  });

  it("returns understanding when understanding is low", () => {
    expect(calculatePathway({ ...baseScores, understandingScore: 2 })).toBe("understanding");
  });

  it("returns understanding when request score is low", () => {
    expect(calculatePathway({ ...baseScores, requestScore: 2 })).toBe("understanding");
  });

  it("returns firstWords when speech is at the boundary", () => {
    expect(calculatePathway({ ...baseScores, speechScore: 3 })).toBe("firstWords");
  });

  it("returns wordCombination when all scores are strong", () => {
    expect(calculatePathway({ ...baseScores, speechScore: 4 })).toBe("wordCombination");
  });
});
