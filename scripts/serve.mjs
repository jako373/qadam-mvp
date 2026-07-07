import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";

const root = resolve(".");
const port = Number(process.env.PORT || 3000);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  return resolve(join(root, clean));
}

async function fileExists(pathname) {
  try {
    const info = await stat(pathname);
    return info.isFile();
  } catch {
    return false;
  }
}

createServer(async (request, response) => {
  const urlPath = request.url || "/";
  let target = safePath(urlPath === "/" ? "/index.html" : urlPath);

  if (!target.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!(await fileExists(target))) {
    const hasExtension = Boolean(extname(urlPath.split("?")[0]));
    if (hasExtension) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    target = join(root, "index.html");
  }

  const body = await readFile(target);
  response.writeHead(200, {
    "Content-Type": mime[extname(target)] || "application/octet-stream",
    "Cache-Control": extname(target) === ".png" ? "public, max-age=31536000, immutable" : "no-cache",
  });
  response.end(body);
}).listen(port, "127.0.0.1", () => {
  console.log(`Qadam MVP running at http://127.0.0.1:${port}`);
});
