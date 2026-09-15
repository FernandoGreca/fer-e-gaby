import ipaddr from "ipaddr.js";
import { resolve4, resolve6 } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
export const MAX_BYTES = 2_000_000;
export function publicIP(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function validateUrl(raw: string) {
  const url = new URL(raw);
  const host = url.hostname
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (
    raw.length > 2048 ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    host === "localhost" ||
    (!host.includes(".") && !host.includes(":")) ||
    /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host) ||
    (ipaddr.isValid(host) && !publicIP(host))
  )
    throw new Error("Endereço não permitido.");
  url.hostname = host.includes(":") ? "[" + host + "]" : host;
  url.hash = "";
  return url;
}
export async function resolvePublic(host: string) {
  host = host.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host)) {
    if (!publicIP(host)) throw new Error("Endereço não permitido.");
    return host;
  }
  const records = await Promise.allSettled([resolve4(host), resolve6(host)]);
  const ips = records.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!ips.length || ips.some((ip) => !publicIP(ip)))
    throw new Error("Destino não permitido ou indisponível.");
  return ips[0];
}
// Connect to the vetted IP without a second DNS lookup. Preserve Host and TLS
// servername so certificate validation stays enabled and DNS rebinding is blocked.
export async function pinnedRequest(
  url: URL,
  ip: string,
  signal: AbortSignal,
): Promise<{ status: number; location?: string; html: string }> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      {
        hostname: ip,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        servername: url.hostname.replace(/^\[|\]$/g, ""),
        agent: false,
        signal,
        headers: {
          Host: url.host,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
          "User-Agent": "FerGabyWishlist/1.0 (product metadata)",
        },
      },
      (res) => {
        const status = res.statusCode ?? 500;
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.destroy();
          resolve({ status, location: res.headers.location, html: "" });
          return;
        }
        if (status < 200 || status >= 300) {
          res.destroy();
          reject(new Error("A loja não permitiu a leitura."));
          return;
        }
        if (
          !/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(
            res.headers["content-type"] ?? "",
          ) ||
          (res.headers["content-encoding"] &&
            res.headers["content-encoding"] !== "identity") ||
          Number(res.headers["content-length"]) > MAX_BYTES
        ) {
          res.destroy();
          reject(new Error("A resposta não é HTML ou excede o limite."));
          return;
        }
        let length = 0;
        const chunks: Uint8Array[] = [];
        res.on("data", (chunk: Uint8Array) => {
          length += chunk.length;
          if (length > MAX_BYTES) {
            res.destroy();
            reject(new Error("Página muito grande."));
          } else chunks.push(chunk);
        });
        res.on("end", () => {
          const merged = new Uint8Array(length);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          resolve({ status, html: new TextDecoder().decode(merged) });
        });
        res.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end();
  });
}
export async function safeFetch(
  raw: string,
  dependencies = { resolvePublic, pinnedRequest },
) {
  const signal = AbortSignal.timeout(9000);
  let url = validateUrl(raw);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const ip = await Promise.race([
      dependencies.resolvePublic(url.hostname),
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("Tempo de leitura esgotado.")),
          { once: true },
        );
        if (signal.aborted) reject(new Error("Tempo de leitura esgotado."));
      }),
    ]);
    const result = await dependencies.pinnedRequest(url, ip, signal);
    if (result.location) {
      if (redirects === 3) throw new Error("Redirecionamentos demais.");
      url = validateUrl(new URL(result.location, url).href);
      continue;
    }
    if (result.status >= 300) throw new Error("Redirecionamento sem destino.");
    return { html: result.html, url: url.href };
  }
  throw new Error("Não foi possível ler a página.");
}
