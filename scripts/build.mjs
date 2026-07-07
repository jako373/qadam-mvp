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
  "lesson/lesson2a",
  "lesson/lesson2b",
  "lesson/lesson2c",
  "lesson/lesson2d",
  "assessment/lesson1",
  "assessment/lesson2a",
  "assessment/lesson2b",
  "assessment/lesson2c",
  "assessment/lesson2d",
];

for (const route of appRoutes) {
  const routeDir = join(dist, route);
  await mkdir(routeDir, { recursive: true });
  await copyFile(join(dist, "index.html"), join(routeDir, "index.html"));
}
