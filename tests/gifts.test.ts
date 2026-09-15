import { describe, it, expect } from "vitest";
import {
  giftSchema,
  giftPayload,
  normalizeTags,
  selectGifts,
  emptyFilters,
  type Gift,
} from "../src/lib/gifts";
const input = {
  wishlist_id: "00000000-0000-4000-8000-000000000001",
  name: "Livro",
  product_url: "https://loja.com/livro",
  image_url: "",
  price: "25,50",
  currency: "BRL",
  priority: "medium" as const,
  description: "",
  notes: "",
  tags: " Livros, livros, Casa ",
  status: "wanted" as const,
};
const gift = (
  id: string,
  priority: Gift["priority"],
  price: number | null,
  extra: Partial<Gift> = {},
): Gift => ({
  ...input,
  id,
  priority,
  price,
  tags: ["livros"],
  created_at: "2026-09-01",
  updated_at: "2026-09-01",
  received_at: null,
  ...extra,
});
describe("gift validation", () => {
  it("normalizes price and tags", () => {
    expect(giftPayload(input)).toMatchObject({
      price: 25.5,
      tags: ["livros", "casa"],
      image_url: null,
    });
    expect(normalizeTags(" , X, x ")).toEqual(["x"]);
  });
  it.each([
    "javascript:alert(1)",
    "ftp://loja.com",
    "https://user:pass@loja.com",
    "invalid",
  ])("rejects unsafe URL %s", (url) =>
    expect(giftSchema.safeParse({ ...input, product_url: url }).success).toBe(
      false,
    ),
  );
  it.each(["-1", "1.001", "NaN", "10000000000"])(
    "rejects invalid price %s",
    (price) =>
      expect(giftSchema.safeParse({ ...input, price }).success).toBe(false),
  );
  it("allows manual entry without price or image", () =>
    expect(
      giftSchema.safeParse({ ...input, price: "", image_url: "" }).success,
    ).toBe(true));
});
describe("lists", () => {
  const gifts = [
    gift("low", "low", 10),
    gift("high-old", "high", 50),
    gift("high-new", "high", 80, { created_at: "2026-09-12" }),
    gift("medium", "medium", null),
    gift("received", "high", 50, {
      status: "received",
      received_at: "2026-09-13",
    }),
  ];
  it("sorts by priority, then newest", () =>
    expect(
      selectGifts(gifts, input.wishlist_id, false, emptyFilters).map(
        (g) => g.id,
      ),
    ).toEqual(["high-new", "high-old", "medium", "low"]));
  it("combines price, priority and tag filters", () =>
    expect(
      selectGifts(gifts, input.wishlist_id, false, {
        priority: "high",
        tag: "livros",
        min: "20",
        max: "60",
      }).map((g) => g.id),
    ).toEqual(["high-old"]));
  it("separates received gifts and sorts by receipt date", () =>
    expect(
      selectGifts(
        [
          ...gifts,
          gift("new-received", "low", 1, {
            status: "received",
            received_at: "2026-09-15",
          }),
        ],
        input.wishlist_id,
        true,
        emptyFilters,
      ).map((g) => g.id),
    ).toEqual(["new-received", "received"]));
  it("excludes unknown prices when filtering", () =>
    expect(
      selectGifts(gifts, input.wishlist_id, false, {
        ...emptyFilters,
        min: "0",
      }).some((g) => g.price === null),
    ).toBe(false));
  it("isolates lists", () =>
    expect(selectGifts(gifts, "another-list", false, emptyFilters)).toEqual(
      [],
    ));
});
