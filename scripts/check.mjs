import { access, readdir, readFile } from "node:fs/promises";
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
  if (!(await exists(join(root, sourceRoot)))) continue;
  for (const filePath of await collectJavaScript(join(root, sourceRoot))) {
    const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
    if (result.status !== 0) failures.push(`${relative(root, filePath)}: ${result.stderr.trim()}`);
  }
}

const index = await readFile(join(root, "index.html"), "utf8");
const app = await readFile(join(root, "src", "app.js"), "utf8");
const authEntry = await readFile(join(root, "src", "auth-entry.js"), "utf8");
const adaptiveFlow = await readFile(join(root, "src", "adaptive-flow.js"), "utf8");
const styles = await readFile(join(root, "src", "styles.css"), "utf8");
const build = await readFile(join(root, "scripts", "build.mjs"), "utf8");
const readme = await readFile(join(root, "README.md"), "utf8");
const manifest = JSON.parse(await readFile(join(root, "public", "manifest.webmanifest"), "utf8"));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

if (!/src="\/src\/auth-entry\.js(?:\?[^\"]+)?"/.test(index)) failures.push("index.html must load /src/auth-entry.js");
if (!index.includes('href="/src/styles.css"')) failures.push("index.html must load /src/styles.css");
if (!index.includes('href="/src/auth.css"')) failures.push("index.html must load /src/auth.css");
if (!index.includes('src="/public/vendor/lucide.min.js"')) failures.push("index.html must load the local Lucide bundle");
if (!/import\("\.\/app\.js(?:\?[^\"]+)?"\)/.test(authEntry)) failures.push("auth entry must load the application on non-auth routes");
if (!app.includes("globalThis.lucide.createIcons")) failures.push("app.js must mount Lucide icons after rendering");
if (/raw\.githubusercontent\.com|qadam-initial-app|exercise-bank/.test(index + app + authEntry)) failures.push("production code must not load a remote or retired application version");
if (/\sstyle=/.test(app + adaptiveFlow + authEntry)) failures.push("inline style attributes are blocked by the production Content Security Policy");
if (/font-size:\s*clamp\(/.test(styles)) failures.push("font sizes must not scale continuously with viewport width");
if (/lesson\/(?:lesson|[0-9])|assessment\/lesson|legacyLessons|loadTimers/.test(app + adaptiveFlow + build)) failures.push("retired guided-lesson runtime code must not return");
for (const retiredFile of [join(root, "src", "data.js"), join(root, "src", "pathway.js")]) {
  if (await exists(retiredFile)) failures.push(`${relative(root, retiredFile)} is retired and must stay removed`);
}
if (/existing 12|12 guided|original 12|src\/data\.js/.test(readme)) failures.push("README.md still describes the retired guided-lesson architecture");
if (/\b12\b/.test(manifest.description) || manifest.start_url !== "/today") failures.push("the installable app manifest still points at the retired lesson experience");
if (packageJson.scripts?.test !== "node --test tests/*.test.js") failures.push("the test command must stay scoped to the canonical tests directory");
if (vercel.outputDirectory !== "dist") failures.push("vercel.json outputDirectory must be dist");
if (!vercel.headers?.[0]?.headers?.some((header) => header.key === "Content-Security-Policy" && header.value.includes("https://iismpbsapzmacxqraecx.supabase.co"))) failures.push("Content Security Policy must allow the Supabase project API");
if (!Array.isArray(vercel.rewrites) || !vercel.rewrites.some((rule) => rule.destination === "/index.html")) failures.push("vercel.json must preserve the SPA fallback");

if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Static checks passed.");
