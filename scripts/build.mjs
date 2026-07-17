import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await import("./compile-exercises.mjs");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ["index.html", "src", "public"]) {
  await cp(join(root, entry), join(dist, entry), { recursive: true });
}

const appRoutes = [
  "login", "register", "forgot-password", "reset-password", "account-mode", "admin", "language", "onboarding", "today", "skill-check", "plan-ready", "daily-summary", "library", "progress", "profile", "subscription",
  ...Array.from({ length: 16 }, (_, index) => `skill-check/${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) => `daily/${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) => `daily-results/${index + 1}`),
  ...Array.from({ length: 8 }, (_, index) => `recheck/${index + 1}`),
  ...["joint_attention", "understanding", "imitation", "communication", "play_thinking", "fine_motor", "regulation", "daily_social"].flatMap((category) => Array.from({ length: 15 }, (_, index) => `library/${category}-${String(index + 1).padStart(2, "0")}`)),
];

for (const route of appRoutes) {
  const routeDirectory = join(dist, route);
  await mkdir(routeDirectory, { recursive: true });
  await copyFile(join(dist, "index.html"), join(routeDirectory, "index.html"));
}

console.log("Qadam build complete: dist/");
