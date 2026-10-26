import { describe, expect, it } from "vitest";
import {
  PLACE_CATEGORIES,
  placePayload,
  placeSchema,
  validatePlaceImage,
} from "../src/lib/places";

const input = {
  name: "  Parque das Flores  ",
  category: "Parque e natureza" as const,
  description: "Um passeio bonito.",
  location: "São Paulo",
  address: "Av. Exemplo, 10",
  map_url: "https://maps.example.com/parque",
  website_url: "",
  event_date: "",
  status: "planned" as const,
  visited_date: "",
};

describe("places", () => {
  it("has a fixed set of categories and normalizes optional fields", () => {
    expect(PLACE_CATEGORIES).toContain("Restaurante");
    expect(PLACE_CATEGORIES).toContain("Outro");
    expect(placePayload(input)).toMatchObject({
      name: "Parque das Flores",
      event_date: null,
      visited_date: null,
    });
  });

  it("accepts an optional visit date only for visited places", () => {
    expect(
      placeSchema.safeParse({
        ...input,
        status: "visited",
        visited_date: "2026-10-10",
      }).success,
    ).toBe(true);
    expect(
      placePayload({ ...input, status: "planned", visited_date: "" })
        .visited_date,
    ).toBeNull();
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "invalid"])(
    "rejects unsafe map links: %s",
    (map_url) =>
      expect(placeSchema.safeParse({ ...input, map_url }).success).toBe(false),
  );

  it("limits photos to supported image formats and sizes", () => {
    expect(() => validatePlaceImage({ type: "image/jpeg", size: 1024 })).not.toThrow();
    expect(() => validatePlaceImage({ type: "image/gif", size: 1024 })).toThrow(/JPEG/);
    expect(() => validatePlaceImage({ type: "image/png", size: 21 * 1024 * 1024 })).toThrow(/20 MB/);
  });
});
