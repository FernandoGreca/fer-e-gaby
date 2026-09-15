import { describe, it, expect } from "vitest";
import {
  imageDimensions,
  validateImage,
  MAX_ORIGINAL_BYTES,
  photoSchema,
  sortPhotos,
  validObjectPath,
  type Photo,
} from "../src/lib/gallery";
describe("gallery image validation", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) =>
    expect(() => validateImage({ type, size: 1024 })).not.toThrow(),
  );
  it.each(["image/gif", "image/heic", "image/svg+xml", "", "text/plain"])(
    "rejects %s",
    (type) => expect(() => validateImage({ type, size: 1024 })).toThrow(/JPEG/),
  );
  it.each([0, MAX_ORIGINAL_BYTES + 1])("rejects invalid size %d", (size) =>
    expect(() => validateImage({ type: "image/jpeg", size })).toThrow(/20 MB/),
  );
  it("preserves ratio, does not enlarge and handles portrait", () => {
    expect(imageDimensions(4000, 3000)).toEqual({ width: 1920, height: 1440 });
    expect(imageDimensions(3000, 4000)).toEqual({ width: 1440, height: 1920 });
    expect(imageDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(() => imageDimensions(0, 100)).toThrow();
  });
  it("only accepts unpredictable flat WebP paths", () => {
    expect(validObjectPath("c231ff00-521a-4f37-b965-63b7891f1767.webp")).toBe(
      true,
    );
    for (const path of [
      "../other/file.webp",
      "file.jpg",
      "https://example.com/x",
      "bucket/file.webp",
    ])
      expect(validObjectPath(path)).toBe(false);
  });
});
describe("photo metadata", () => {
  it("validates real dates and caption length", () => {
    expect(
      photoSchema.safeParse({ caption: "ok", photo_date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      photoSchema.safeParse({ caption: "ok", photo_date: "" }).success,
    ).toBe(false);
    expect(
      photoSchema.safeParse({
        caption: "x".repeat(1001),
        photo_date: "2026-09-15",
      }).success,
    ).toBe(false);
    expect(
      photoSchema.parse({ caption: "  juntos  ", photo_date: "2024-02-29" })
        .caption,
    ).toBe("juntos");
  });
  it("orders date then creation then id without mutating source", () => {
    const photos = [
      { id: "1", photo_date: "2025-01-01", created_at: "2026-09-14" },
      { id: "2", photo_date: "2026-01-01", created_at: "2026-09-14" },
      { id: "3", photo_date: "2026-01-01", created_at: "2026-09-15" },
    ] as Photo[];
    expect(sortPhotos(photos).map((p) => p.id)).toEqual(["3", "2", "1"]);
    expect(photos[0].id).toBe("1");
  });
});
