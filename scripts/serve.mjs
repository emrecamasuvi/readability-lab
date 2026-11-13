// Minimal static file server for tests, demos and `pnpm start`.
//   CLI: node scripts/serve.mjs <dir> <port>
//   API: import { serve } from "./serve.mjs"; await serve({ root, port, dev: true })
import { createServer } from "node:http";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".map": "application/json" };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Serve a directory. `dev: true` disables caching (edits show up on reload) and lists
 * directories without an index.html. Resolves with the server once it is listening.
 */
export function serve({ root, port, dev = false, quiet = false }) {
  // Canonical root: containment is checked on real paths, so a symlink cannot lead outside it.
  const base = realpathSync(resolve(root));
  const inside = (p) => p === base || p.startsWith(base + sep);
  const server = createServer(async (req, res) => {
    let url, path;
    try {
      url = new URL(req.url ?? "/", "http://x");
      path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    } catch {
      return res.writeHead(400, { "content-type": "text/plain" }).end("bad request");
    }
    if (path.includes("\0")) return res.writeHead(400, { "content-type": "text/plain" }).end("bad request");
    let file;
    try {
      file = await realpath(join(base, path));
      if (!inside(file)) return res.writeHead(403).end();
      const st = await stat(file);
      if (st.isDirectory()) {
        if (!url.pathname.endsWith("/")) return res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
        const index = join(file, "index.html");
        try {
          file = await realpath(index);
          if (!inside(file)) return res.writeHead(403).end();
        } catch {
          if (!dev) throw new Error("no index");
          const entries = (await readdir(file, { withFileTypes: true })).filter((e) => !e.name.startsWith(".") && e.name !== "node_modules");
          const items = entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name)).map((e) => `<li><a href="${esc(e.name)}${e.isDirectory() ? "/" : ""}">${esc(e.name)}${e.isDirectory() ? "/" : ""}</a></li>`);
          return res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(`<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>${esc(url.pathname)}</title><body style="font:16px/1.6 system-ui;max-width:48rem;margin:2rem auto;padding:0 1rem"><h1 style="font-size:1.2rem">${esc(url.pathname)}</h1><ul>${items.join("")}</ul>`);
        }
      }
      const body = await readFile(file);
      const ext = extname(file);
      const headers = { "content-type": types[ext] ?? "application/octet-stream" };
      // Production-like caching unless dev; nostore-* files are test fixtures that must never be cached.
      headers["cache-control"] = /nostore-/.test(file) || dev ? "no-store" : ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable";
      const compressible = /\.(html|m?js|css|json|svg|md|txt|map)$/.test(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
      if (compressible) {
        headers["content-encoding"] = "gzip";
        headers["vary"] = "accept-encoding";
        return res.writeHead(200, headers).end(gzipSync(body));
      }
      res.writeHead(200, headers).end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "localhost", () => {
      if (!quiet) console.log(`serving ${base} on http://localhost:${port}`);
      ok(server);
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await serve({ root: process.argv[2] ?? "fixtures", port: Number(process.argv[3] ?? 4320) });
}
