import { describe, expect, it, vi } from "vitest";
import {
  decodeChunked,
  socketRequest,
  type SocketRuntime,
  type Socket,
} from "../supabase/functions/extract-product/socket-transport";

function fixture(response: string, readSize = 13) {
  const bytes = new TextEncoder().encode(response);
  let position = 0;
  const writes: Uint8Array[] = [];
  const socket: Socket = {
    async read(buffer) {
      if (position === bytes.length) return null;
      const n = Math.min(readSize, buffer.length, bytes.length - position);
      buffer.set(bytes.subarray(position, position + n));
      position += n;
      return n;
    },
    async write(buffer) {
      const n = Math.min(buffer.length, 7);
      writes.push(buffer.slice(0, n));
      return n;
    },
    close: vi.fn(),
  };
  const runtime: SocketRuntime = {
    connect: vi.fn(async () => socket),
    startTls: vi.fn(async () => socket),
  };
  return { runtime, socket, writes };
}
describe("native Edge socket transport", () => {
  it("pins the TCP IP while preserving TLS hostname and HTTP Host", async () => {
    const f = fixture(
      "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 5\r\n\r\nHello",
    );
    expect(
      await socketRequest(
        new URL("https://loja.example/book?q=1"),
        "1.1.1.1",
        AbortSignal.timeout(1000),
        f.runtime,
      ),
    ).toEqual({ status: 200, html: "Hello" });
    expect(f.runtime.connect).toHaveBeenCalledWith({
      hostname: "1.1.1.1",
      port: 443,
    });
    expect(f.runtime.startTls).toHaveBeenCalledWith(f.socket, {
      hostname: "loja.example",
    });
    expect(new TextDecoder().decode(Buffer.concat(f.writes))).toContain(
      "GET /book?q=1 HTTP/1.1\r\nHost: loja.example\r\n",
    );
    expect(f.socket.close).toHaveBeenCalledOnce();
  });
  it("decodes chunked UTF-8 by bytes across fragmented reads", async () => {
    const f = fixture(
      "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nolá!\r\n0\r\n\r\n",
      1,
    );
    expect(
      await socketRequest(
        new URL("http://loja.example/"),
        "1.1.1.1",
        AbortSignal.timeout(1000),
        f.runtime,
      ),
    ).toMatchObject({ html: "olá!" });
    expect(f.runtime.startTls).not.toHaveBeenCalled();
  });
  it("closes redirect responses before downloading the body", async () => {
    const f = fixture(
      "HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/\r\n\r\nignored",
    );
    expect(
      await socketRequest(
        new URL("https://loja.example/"),
        "1.1.1.1",
        AbortSignal.timeout(1000),
        f.runtime,
      ),
    ).toEqual({ status: 302, location: "http://127.0.0.1/", html: "" });
    expect(f.socket.close).toHaveBeenCalledOnce();
  });
  it.each([
    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{}",
    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 2000001\r\n\r\n",
    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Encoding: gzip\r\n\r\n",
    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 20\r\n\r\nshort",
    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 2\r\nContent-Length: 3\r\n\r\n",
    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nTransfer-Encoding: chunked\r\nContent-Length: 3\r\n\r\n",
    "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html\r\n\r\nblocked",
  ])(
    "fails closed on invalid, blocked or unsafe responses",
    async (response) => {
      const f = fixture(response);
      await expect(
        socketRequest(
          new URL("https://loja.example/"),
          "1.1.1.1",
          AbortSignal.timeout(1000),
          f.runtime,
        ),
      ).rejects.toThrow();
      expect(f.socket.close).toHaveBeenCalledOnce();
    },
  );
  it("propagates TLS errors and closes the socket", async () => {
    const f = fixture("");
    f.runtime.startTls = vi.fn(async () => {
      throw new Error("certificate validation failed");
    });
    await expect(
      socketRequest(
        new URL("https://loja.example/"),
        "1.1.1.1",
        AbortSignal.timeout(1000),
        f.runtime,
      ),
    ).rejects.toThrow("certificate validation failed");
    expect(f.socket.close).toHaveBeenCalledOnce();
  });
  it("rejects already aborted requests without connecting", async () => {
    const f = fixture("");
    await expect(
      socketRequest(
        new URL("https://loja.example/"),
        "1.1.1.1",
        AbortSignal.abort(),
        f.runtime,
      ),
    ).rejects.toThrow();
    expect(f.runtime.connect).not.toHaveBeenCalled();
  });
  it.each(["z\r\nbody\r\n0\r\n\r\n", "20\r\nshort", "200000\r\n", "1\r\naXX"])(
    "rejects malformed chunks",
    (body) => {
      expect(() => decodeChunked(new TextEncoder().encode(body))).toThrow();
    },
  );
});
