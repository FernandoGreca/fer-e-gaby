export const BODY_LIMIT = 2_000_000;
const HEADER_LIMIT = 32_768;
const WIRE_LIMIT = BODY_LIMIT + 65_536;
const decoder = new TextDecoder();
export type Socket = {
  read(buffer: Uint8Array): Promise<number | null>;
  write(buffer: Uint8Array): Promise<number>;
  close(): void;
};
export type SocketRuntime = {
  connect(options: { hostname: string; port: number }): Promise<Socket>;
  startTls(socket: Socket, options: { hostname: string }): Promise<Socket>;
};
function boundary(bytes: Uint8Array, start = 0) {
  for (let i = start; i < bytes.length - 3; i++)
    if (
      bytes[i] === 13 &&
      bytes[i + 1] === 10 &&
      bytes[i + 2] === 13 &&
      bytes[i + 3] === 10
    )
      return i;
  return -1;
}
function responseHead(bytes: Uint8Array) {
  const lines = decoder.decode(bytes).split("\r\n");
  const status = Number(
    /^HTTP\/1\.[01] (\d{3})\b/.exec(lines.shift() ?? "")?.[1],
  );
  if (!status) throw new Error("Resposta HTTP inválida.");
  const headers = new Map<string, string>();
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 1) throw new Error("Cabeçalho inválido.");
    const key = line.slice(0, colon).toLowerCase();
    if (
      headers.has(key) &&
      ["content-length", "transfer-encoding", "location"].includes(key)
    )
      throw new Error("Cabeçalho ambíguo.");
    headers.set(key, line.slice(colon + 1).trim());
  }
  return { status, headers };
}
export function decodeChunked(bytes: Uint8Array) {
  const chunks: Uint8Array[] = [];
  let offset = 0,
    size = 0;
  while (offset < bytes.length) {
    let end = offset;
    while (
      end + 1 < bytes.length &&
      !(bytes[end] === 13 && bytes[end + 1] === 10)
    )
      end++;
    if (end - offset > 1024 || end + 1 >= bytes.length)
      throw new Error("Chunk inválido.");
    const line = decoder.decode(bytes.subarray(offset, end)).split(";")[0];
    if (!/^[0-9a-f]+$/i.test(line)) throw new Error("Chunk inválido.");
    const length = Number.parseInt(line, 16);
    offset = end + 2;
    if (length === 0) {
      if (offset + 1 >= bytes.length) throw new Error("Resposta incompleta.");
      const result = new Uint8Array(size);
      let at = 0;
      for (const chunk of chunks) {
        result.set(chunk, at);
        at += chunk.length;
      }
      return result;
    }
    if (!Number.isSafeInteger(length) || size + length > BODY_LIMIT)
      throw new Error("Página muito grande.");
    if (
      offset + length + 2 > bytes.length ||
      bytes[offset + length] !== 13 ||
      bytes[offset + length + 1] !== 10
    )
      throw new Error("Resposta incompleta.");
    chunks.push(bytes.subarray(offset, offset + length));
    size += length;
    offset += length + 2;
  }
  throw new Error("Resposta incompleta.");
}
// Native TCP followed by TLS preserves the vetted IP and the original TLS
// servername. The Edge Runtime's node:https shim loses this distinction.
export async function socketRequest(
  url: URL,
  ip: string,
  signal: AbortSignal,
  runtime: SocketRuntime,
) {
  let socket: Socket | undefined;
  const close = () => {
    try {
      socket?.close();
    } catch {
      /* Already closed. */
    }
  };
  const abort = () => {
    close();
  };
  signal.throwIfAborted();
  signal.addEventListener("abort", abort, { once: true });
  try {
    const connection = runtime.connect({
      hostname: ip,
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    });
    socket = await Promise.race([
      connection.then((conn) => {
        if (signal.aborted) {
          conn.close();
          signal.throwIfAborted();
        }
        return conn;
      }),
      new Promise<never>((_resolve, reject) =>
        signal.addEventListener(
          "abort",
          () => reject(new Error("Tempo de leitura esgotado.")),
          { once: true },
        ),
      ),
    ]);
    if (url.protocol === "https:")
      socket = await runtime.startTls(socket, {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
      });
    signal.throwIfAborted();
    const request = new TextEncoder().encode(
      "GET " +
        url.pathname +
        url.search +
        " HTTP/1.1\r\nHost: " +
        url.host +
        "\r\nAccept: text/html,application/xhtml+xml\r\nAccept-Encoding: identity\r\nUser-Agent: FerGabyWishlist/1.0 (product metadata)\r\nConnection: close\r\n\r\n",
    );
    for (let offset = 0; offset < request.length;) {
      signal.throwIfAborted();
      const n = await socket.write(request.subarray(offset));
      if (!n) throw new Error("Falha de conexão.");
      offset += n;
    }
    const wire = new Uint8Array(WIRE_LIMIT);
    let length = 0,
      headerEnd = -1;
    let head: ReturnType<typeof responseHead> | undefined;
    while (true) {
      signal.throwIfAborted();
      if (length === wire.length) throw new Error("Página muito grande.");
      const n = await socket.read(
        wire.subarray(length, Math.min(length + 16_384, wire.length)),
      );
      if (n === null) break;
      length += n;
      if (headerEnd === -1) {
        headerEnd = boundary(wire.subarray(0, length));
        if (headerEnd === -1) {
          if (length > HEADER_LIMIT) throw new Error("Cabeçalho muito grande.");
          continue;
        }
        if (headerEnd > HEADER_LIMIT)
          throw new Error("Cabeçalho muito grande.");
        head = responseHead(wire.subarray(0, headerEnd));
        if ([301, 302, 303, 307, 308].includes(head.status))
          return {
            status: head.status,
            location: head.headers.get("location"),
            html: "",
          };
        if (head.status < 200 || head.status >= 300)
          throw new Error("A loja não permitiu a leitura.");
        if (
          !/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(
            head.headers.get("content-type") ?? "",
          )
        )
          throw new Error("A resposta não é HTML.");
        const encoding = head.headers.get("content-encoding");
        if (encoding && encoding !== "identity")
          throw new Error("Conteúdo comprimido não permitido.");
        const transfer = head.headers.get("transfer-encoding"),
          declared = head.headers.get("content-length");
        if (transfer && (transfer.toLowerCase() !== "chunked" || declared))
          throw new Error("Transferência não permitida.");
        if (
          declared &&
          (!/^\d+$/.test(declared) || Number(declared) > BODY_LIMIT)
        )
          throw new Error("Página muito grande.");
      }
      const declared = head?.headers.get("content-length");
      if (declared && length >= headerEnd + 4 + Number(declared)) break;
    }
    if (!head) throw new Error("Resposta HTTP incompleta.");
    let body = wire.subarray(headerEnd + 4, length);
    if (head.headers.get("transfer-encoding")?.toLowerCase() === "chunked")
      body = decodeChunked(body);
    else {
      const declared = head.headers.get("content-length");
      if (declared) {
        if (body.length < Number(declared))
          throw new Error("Resposta incompleta.");
        body = body.subarray(0, Number(declared));
      }
      if (body.length > BODY_LIMIT) throw new Error("Página muito grande.");
    }
    return { status: head.status, html: decoder.decode(body) };
  } finally {
    signal.removeEventListener("abort", abort);
    close();
  }
}
