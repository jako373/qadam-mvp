import { exercises } from "../src/data/exercises.js";
import { exerciseCategoryOrder } from "../src/data/exercise-localization.js";

const minimumReadyPerLevel = Number(process.env.QADAM_MIN_READY_PER_LEVEL || 8);
const requestedBatchSize = Number(process.env.QADAM_GENERATION_BATCH || 5);
const queue = [];

for (const category of exerciseCategoryOrder) {
  for (const level of [1, 2, 3]) {
    const ready = exercises.filter((exercise) => exercise.isActive && exercise.category === category && exercise.level === level).length;
    if (ready >= minimumReadyPerLevel) continue;
    queue.push({
      category,
      level,
      ready,
      target: minimumReadyPerLevel,
      create: Math.max(requestedBatchSize, minimumReadyPerLevel - ready),
      reason: "active_inventory_below_threshold",
    });
  }
}

const report = {
  checkedAt: new Date().toISOString(),
  activeExercises: exercises.filter((exercise) => exercise.isActive).length,
  minimumReadyPerLevel,
  status: queue.length ? "generation_needed" : "inventory_healthy",
  queue,
};

console.log(JSON.stringify(report, null, 2));
if (queue.length) process.exitCode = 2;
