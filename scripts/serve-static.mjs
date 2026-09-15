import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out"),
  base = "/fer-e-gabi";
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (!url.pathname.startsWith(base + "/")) {
        res.writeHead(404).end();
        return;
      }
      let name = path.resolve(
        root,
        "." + decodeURIComponent(url.pathname.slice(base.length)),
      );
      if (name !== root && !name.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(name)).isDirectory())
        name = path.join(name, "index.html");
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".txt": "text/plain",
        ".ico": "image/x-icon",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(name)] ?? "application/octet-stream",
      );
      res.end(await readFile(name));
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(3000, "0.0.0.0", () =>
    console.log("Static preview: http://localhost:3000/fer-e-gabi/"),
  );
