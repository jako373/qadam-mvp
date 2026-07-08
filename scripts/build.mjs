import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ["index.html", "src", "public"]) {
  await cp(join(root, entry), join(dist, entry), { recursive: true });
}

const appRoutes = [
  "language",
  "onboarding",
  "intro",
  "dashboard",
  "lessons",
  "result",
  "progress",
  "profile",
  "lesson/lesson1",
  "lesson/lesson2",
  "lesson/lesson3",
  "lesson/lesson4",
  "lesson/lesson5",
  "lesson/lesson6",
  "lesson/lesson7",
  "lesson/lesson8",
  "lesson/lesson9",
  "lesson/lesson10",
  "lesson/lesson11",
  "lesson/lesson12",
  "assessment/lesson1",
  "assessment/lesson2",
  "assessment/lesson3",
  "assessment/lesson4",
  "assessment/lesson5",
  "assessment/lesson6",
  "assessment/lesson7",
  "assessment/lesson8",
  "assessment/lesson9",
  "assessment/lesson10",
  "assessment/lesson11",
  "assessment/lesson12",
];

for (const route of appRoutes) {
  const routeDir = join(dist, route);
  await mkdir(routeDir, { recursive: true });
  await copyFile(join(dist, "index.html"), join(routeDir, "index.html"));
}
