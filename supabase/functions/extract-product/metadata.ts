import { load } from "cheerio";
export function clean(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string") return;
  return (
    load(value)
      .text()
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max) || undefined
  );
}
export function parsePrice(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 && value < 1e10
      ? Math.round(value * 100) / 100
      : undefined;
  if (typeof value !== "string") return;
  let v = value.replace(/[^\d.,-]/g, "");
  if (!v) return;
  if (v.includes(",") && v.includes("."))
    v =
      v.lastIndexOf(",") > v.lastIndexOf(".")
        ? v.replace(/\./g, "").replace(",", ".")
        : v.replace(/,/g, "");
  else if (v.includes(","))
    v = /,\d{1,2}$/.test(v) ? v.replace(",", ".") : v.replace(/,/g, "");
  return parsePrice(Number(v));
}
function safeImage(value: unknown, base: string) {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value, base);
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.href.length <= 2048
    )
      return url.href;
  } catch {}
}
type RecordValue = Record<string, unknown>;
export function extractMetadata(html: string, base: string) {
  const $ = load(html),
    meta = (key: string) =>
      $("meta")
        .filter(
          (_i, e) =>
            $(e).attr("property") === key ||
            $(e).attr("name") === key ||
            $(e).attr("itemprop") === key,
        )
        .first()
        .attr("content");
  let product: RecordValue | undefined;
  function walk(node: unknown, depth = 0) {
    if (depth > 15 || product || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((v) => walk(v, depth + 1));
      return;
    }
    const obj = node as RecordValue;
    if (
      [obj["@type"]]
        .flat()
        .some((t) => typeof t === "string" && /(^|\/)Product$/.test(t))
    ) {
      product = obj;
      return;
    }
    Object.values(obj).forEach((v) => walk(v, depth + 1));
  }
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      walk(JSON.parse($(el).text()));
    } catch {
      /* Use fallbacks for malformed structured data. */
    }
  });
  const p = (product ?? {}) as RecordValue;
  const offer = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as
    RecordValue | undefined;
  let image = Array.isArray(p.image) ? p.image[0] : p.image;
  if (image && typeof image === "object") image = (image as RecordValue).url;
  const name =
    clean(p.name) ??
    clean(meta("og:title")) ??
    clean($("title").first().text());
  const imageUrl =
    safeImage(image, base) ??
    safeImage(meta("og:image"), base) ??
    safeImage(meta("twitter:image"), base);
  const price =
    parsePrice(offer?.price ?? offer?.lowPrice) ??
    parsePrice(meta("product:price:amount")) ??
    parsePrice(meta("og:price:amount")) ??
    parsePrice(meta("price"));
  const rawCurrency =
    clean(offer?.priceCurrency) ??
    clean(meta("product:price:currency")) ??
    clean(meta("og:price:currency")) ??
    clean(meta("priceCurrency"));
  const currency =
    rawCurrency && /^[a-z]{3}$/i.test(rawCurrency)
      ? rawCurrency.toUpperCase()
      : undefined;
  const warnings: string[] = [];
  if (!name) warnings.push("Nome não encontrado.");
  if (!imageUrl) warnings.push("Imagem não encontrada.");
  if (price === undefined) warnings.push("Preço não encontrado.");
  if (!currency) warnings.push("Moeda não encontrada.");
  return { name, imageUrl, price, currency, warnings };
}
