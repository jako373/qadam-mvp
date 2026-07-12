import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["src", "scripts", "tests"];
const failures = [];

async function collectJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScript(filePath)));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(filePath);
  }
  return files;
}

for (const sourceRoot of sourceRoots) {
  for (const filePath of await collectJavaScript(join(root, sourceRoot))) {
    const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
    if (result.status !== 0) {
      failures.push(`${relative(root, filePath)}: ${result.stderr.trim()}`);
    }
  }
}

const index = await readFile(join(root, "index.html"), "utf8");
const app = await readFile(join(root, "src", "app.js"), "utf8");
const adaptiveFlow = await readFile(join(root, "src", "adaptive-flow.js"), "utf8");
const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));

if (!index.includes('src="/src/app.js"')) failures.push("index.html must load /src/app.js");
if (!index.includes('href="/src/styles.css"')) failures.push("index.html must load /src/styles.css");
if (/raw\.githubusercontent\.com|qadam-initial-app|exercise-bank/.test(index + app)) {
  failures.push("production code must not load a remote or retired application version");
}
if (/\sstyle=/.test(app + adaptiveFlow)) {
  failures.push("inline style attributes are blocked by the production Content Security Policy");
}
if (vercel.outputDirectory !== "dist") failures.push("vercel.json outputDirectory must be dist");
if (!Array.isArray(vercel.rewrites) || !vercel.rewrites.some((rule) => rule.destination === "/index.html")) {
  failures.push("vercel.json must preserve the SPA fallback");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Static checks passed.");
