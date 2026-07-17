import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FREE_EXERCISE_LIMIT,
  SUBSCRIPTION_PLANS,
  freeExerciseIds,
  freemiumRouteRedirect,
  hasFullAccess,
} from "../src/lib/access-control.js";

const state = {
  adaptive: {
    activePlanDate: "2026-07-17",
    dailyPlans: {
      "2026-07-17": { items: [{ exerciseId: "a-01" }, { exerciseId: "b-01" }, { exerciseId: "c-01" }] },
      "2026-07-18": { items: [{ exerciseId: "d-01" }, { exerciseId: "e-01" }, { exerciseId: "f-01" }] },
    },
  },
};

describe("freemium access", () => {
  it("keeps the requested four subscription prices", () => {
    assert.deepEqual(SUBSCRIPTION_PLANS.map(({ months, priceKzt }) => [months, priceKzt]), [
      [1, 4990], [3, 9990], [6, 15990], [12, 27990],
    ]);
  });

  it("unlocks exactly the first three daily exercises", () => {
    assert.equal(FREE_EXERCISE_LIMIT, 3);
    assert.deepEqual(freeExerciseIds(state.adaptive), ["a-01", "b-01", "c-01"]);
  });

  it("allows active paid, complimentary and admin access", () => {
    assert.equal(hasFullAccess({ access_tier: "paid", access_until: "2026-07-31" }, "2026-07-17"), true);
    assert.equal(hasFullAccess({ access_tier: "complimentary" }, "2026-07-17"), true);
    assert.equal(hasFullAccess({ role: "superadmin", access_tier: "standard" }, "2026-07-17"), true);
    assert.equal(hasFullAccess({ access_tier: "paid", access_until: "2026-07-16" }, "2026-07-17"), false);
  });

  it("redirects locked exercise details and later plans to subscription", () => {
    assert.equal(freemiumRouteRedirect("/library/a-01", state, {}), null);
    assert.equal(freemiumRouteRedirect("/library/d-01", state, {}), "/subscription");
    const later = { adaptive: { ...state.adaptive, activePlanDate: "2026-07-18" } };
    assert.equal(freemiumRouteRedirect("/daily/1", later, {}), "/subscription");
  });
});

