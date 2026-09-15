import { describe, it, expect, vi } from "vitest";
import {
  extractMetadata,
  parsePrice,
} from "../supabase/functions/extract-product/metadata";
import {
  publicIP,
  validateUrl,
  safeFetch,
} from "../supabase/functions/extract-product/safe-fetch";
describe("metadata", () => {
  it("prefers JSON-LD Product in graphs over Open Graph", () => {
    const html =
      '<meta property="og:title" content="Other"><script type="application/ld+json">' +
      JSON.stringify({
        "@graph": [
          {
            "@type": ["Product"],
            name: "<b>Presente</b>",
            image: ["/foto.jpg"],
            offers: { price: "1.299,90", priceCurrency: "brl" },
          },
        ],
      }) +
      "</script>";
    expect(extractMetadata(html, "https://loja.com/item")).toEqual({
      name: "Presente",
      imageUrl: "https://loja.com/foto.jpg",
      price: 1299.9,
      currency: "BRL",
      warnings: [],
    });
  });
  it("handles malformed JSON-LD and fallback metadata", () =>
    expect(
      extractMetadata(
        '<script type="application/ld+json">bad</script><meta property="og:title" content="Livro &amp; amor"><meta name="price" content="45.00"><title>Other</title>',
        "https://loja.com",
      ),
    ).toMatchObject({ name: "Livro & amor", price: 45 }));
  it("returns partial results and strips unsafe image URLs", () => {
    const result = extractMetadata(
      '<title>Manual</title><meta property="og:image" content="javascript:evil()">',
      "https://loja.com",
    );
    expect(result.name).toBe("Manual");
    expect(result.imageUrl).toBeUndefined();
    expect(result.warnings).toHaveLength(3);
  });
  it.each([
    ["R$ 1.299,90", 1299.9],
    ["1,299.90", 1299.9],
    ["0", 0],
    ["-5", undefined],
    ["n/a", undefined],
    ["", undefined],
  ])("normalizes price %s", (v, expected) =>
    expect(parsePrice(v)).toBe(expected),
  );
});
describe("SSRF protection", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.2",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])("blocks non-public address %s", (ip) => expect(publicIP(ip)).toBe(false));
  it("accepts public IPs", () => {
    expect(publicIP("1.1.1.1")).toBe(true);
    expect(publicIP("2606:4700:4700::1111")).toBe(true);
  });
  it.each([
    "http://localhost",
    "http://127.1",
    "http://2130706433",
    "http://[::1]",
    "file:///etc/passwd",
    "https://user:pass@loja.com",
    "https://loja.com:8443",
    "http://printer.local",
  ])("rejects URL %s", (url) => expect(() => validateUrl(url)).toThrow());
  it("revalidates redirects and never connects to local targets", async () => {
    const resolvePublic = vi.fn().mockResolvedValue("1.1.1.1"),
      pinnedRequest = vi.fn().mockResolvedValue({
        status: 302,
        location: "http://127.0.0.1",
        html: "",
      });
    await expect(
      safeFetch("https://loja.com", { resolvePublic, pinnedRequest }),
    ).rejects.toThrow();
    expect(pinnedRequest).toHaveBeenCalledTimes(1);
  });
  it("limits redirect loops", async () => {
    const deps = {
      resolvePublic: vi.fn().mockResolvedValue("1.1.1.1"),
      pinnedRequest: vi
        .fn()
        .mockResolvedValue({ status: 302, location: "/loop", html: "" }),
    };
    await expect(safeFetch("https://loja.com", deps)).rejects.toThrow(
      "Redirecionamentos",
    );
    expect(deps.pinnedRequest).toHaveBeenCalledTimes(4);
  });
});
