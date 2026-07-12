import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const port = Number(process.env.PORT || 3000);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safePath(urlPath) {
  try {
    const pathname = decodeURIComponent(urlPath.split("?")[0]).replace(/^[/\\]+/, "");
    const target = resolve(root, pathname);
    const fromRoot = relative(root, target);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
    return target;
  } catch {
    return null;
  }
}

async function fileExists(pathname) {
  try {
    return (await stat(pathname)).isFile();
  } catch {
    return false;
  }
}

createServer(async (request, response) => {
  try {
    if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const urlPath = request.url;
    let target = safePath(urlPath === "/" ? "/index.html" : urlPath);
    if (!target) {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    if (!(await fileExists(target))) {
      if (extname(urlPath.split("?")[0])) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      target = join(root, "index.html");
    }

    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": mime[extname(target)] || "application/octet-stream",
      "Cache-Control": extname(target) === ".png" ? "public, max-age=604800" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500);
    response.end("Internal server error");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Qadam MVP running at http://127.0.0.1:${port}`);
});
