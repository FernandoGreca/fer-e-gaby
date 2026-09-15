import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import {
  pinnedRequest,
  MAX_BYTES,
} from "../supabase/functions/extract-product/safe-fetch";
let server: Server, port: number;
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/slow") return;
    if (req.url === "/json") {
      res.setHeader("Content-Type", "application/json");
      res.end("{}");
      return;
    }
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: "http://localhost/private" }).end();
      return;
    }
    res.setHeader("Content-Type", "text/html");
    if (req.url === "/large") {
      res.end("x".repeat(MAX_BYTES + 1));
      return;
    }
    res.end("<title>Allowed HTML</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
describe("bounded HTTP transport (isolated local fixture)", () => {
  const call = (path: string, ms = 1000) =>
    pinnedRequest(
      new URL("http://fixture.example:" + port + path),
      "127.0.0.1",
      AbortSignal.timeout(ms),
    );
  it("reads bounded HTML", async () =>
    expect(await call("/ok")).toMatchObject({
      html: "<title>Allowed HTML</title>",
      status: 200,
    }));
  it("rejects non-HTML", async () =>
    await expect(call("/json")).rejects.toThrow());
  it("rejects oversized streams", async () =>
    await expect(call("/large")).rejects.toThrow());
  it("returns redirects without following them", async () =>
    expect(await call("/redirect")).toMatchObject({
      status: 302,
      location: "http://localhost/private",
    }));
  it("aborts stalled requests", async () =>
    await expect(call("/slow", 50)).rejects.toThrow());
});
