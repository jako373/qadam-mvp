import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  exerciseCategoryOrder,
  localizeExercise,
} from "../src/data/exercise-localization.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "src", "data", "exercises.ts");
const outputPath = join(root, "src", "data", "exercises.js");
const marker = "export const exercises: Exercise[] = ";
const source = await readFile(sourcePath, "utf8");
const start = source.indexOf(marker);
const arrayEnd = source.match(/\];\s*$/);
const end = arrayEnd?.index ?? -1;

if (start < 0 || end < 0) throw new Error("Could not find the exercises array in exercises.ts");

const rawExercises = JSON.parse(source.slice(start + marker.length, end + 1));
if (!rawExercises.length) throw new Error("The exercise catalogue must not be empty");

const localized = [];
for (const category of exerciseCategoryOrder) {
  const categoryExercises = rawExercises.filter((exercise) => exercise.category === category);
  if (!categoryExercises.length) throw new Error(`${category} must contain exercises`);
  for (const level of [1, 2, 3]) {
    if (!categoryExercises.some((exercise) => exercise.level === level)) {
      throw new Error(`${category} level ${level} must contain at least one exercise`);
    }
  }
  categoryExercises.forEach((exercise, index) => localized.push(localizeExercise(exercise, index)));
}

const ids = new Set(localized.map((exercise) => exercise.id));
if (ids.size !== localized.length) throw new Error("Exercise IDs must be unique");

const output = `// Generated from src/data/exercises.ts by scripts/compile-exercises.mjs.\n` +
  `// Edit the TypeScript source or localization map, then regenerate this file.\n\n` +
  `export const exercises = ${JSON.stringify(localized, null, 2)};\n\n` +
  `const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));\n\n` +
  `export function replaceExercises(nextExercises) {\n  exercises.splice(0, exercises.length, ...nextExercises);\n  exerciseById.clear();\n  for (const exercise of exercises) exerciseById.set(exercise.id, exercise);\n}\n\n` +
  `export function getExerciseById(id) {\n  return exerciseById.get(id) || null;\n}\n`;

await writeFile(outputPath, output, "utf8");
console.log(`Compiled ${localized.length} bilingual exercises.`);
