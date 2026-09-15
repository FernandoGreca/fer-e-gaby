import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup, login } from "./helpers";
import type { Photo } from "../src/lib/gallery";
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGOY6p+GFTEMLQkASGhSgVK7IqwAAAAASUVORK5CYII=",
  "base64",
);
async function gallerySetup(
  page: Page,
  empty = false,
  failInsert = false,
  failStorageDelete = false,
) {
  await setup(page, true);
  let photos: Photo[] = empty
    ? []
    : [
        {
          id: "one",
          object_path: "00000000-0000-4000-8000-000000000001.webp",
          caption: "Primeiro encontro",
          photo_date: "2025-01-01",
          created_at: "2026-09-15",
          updated_at: "2026-09-15",
        },
        {
          id: "two",
          object_path: "00000000-0000-4000-8000-000000000002.webp",
          caption: "Nosso passeio",
          photo_date: "2026-09-10",
          created_at: "2026-09-14",
          updated_at: "2026-09-14",
        },
      ];
  const calls = {
    uploads: 0,
    removes: 0,
    metadata: 0,
    dimensions: { width: 0, height: 0 },
  };
  await page.route("**/storage/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "DELETE") {
      calls.removes++;
      await route.fulfill(
        failStorageDelete
          ? { status: 400, json: { error: "offline" } }
          : { json: [] },
      );
    } else if (req.url().includes("/list/")) await route.fulfill({ json: [] });
    else if (req.method() === "POST") {
      calls.uploads++;
      expect(req.url()).toMatch(/\/[0-9a-f-]{36}\.webp$/);
      const body = req.postDataBuffer()!;
      const start = body.indexOf("RIFF");
      expect(start).toBeGreaterThanOrEqual(0);
      const webp = body.subarray(
        start,
        start + body.readUInt32LE(start + 4) + 8,
      );
      expect(webp.subarray(8, 12).toString()).toBe("WEBP");
      expect(webp.includes(Buffer.from("EXIF"))).toBe(false);
      calls.dimensions = await page.evaluate(
        async (bytes) => {
          const bitmap = await createImageBitmap(
            new Blob([Uint8Array.from(bytes)], { type: "image/webp" }),
          );
          const dimensions = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          return dimensions;
        },
        [...webp],
      );
      expect(req.headers()["x-upsert"]).toBe("false");
      await route.fulfill({ json: { Key: "photo.webp" } });
    } else await route.fulfill({ contentType: "image/png", body: image });
  });
  await page.route("**/rest/v1/gallery_cleanup*", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route("**/rest/v1/gallery_photos*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const id = url.searchParams.get("id")?.slice(3);
    if (req.method() === "POST") {
      calls.metadata++;
      if (failInsert) {
        await route.fulfill({
          status: 400,
          json: { message: "Metadata failed" },
        });
        return;
      }
      const photo = {
        ...req.postDataJSON(),
        id: "new",
        created_at: "2026-09-15",
        updated_at: "2026-09-15",
      };
      photos.push(photo);
      await route.fulfill({ json: photo });
    } else if (req.method() === "PATCH") {
      const photo = photos.find((p) => p.id === id)!;
      Object.assign(photo, req.postDataJSON());
      await route.fulfill({ json: photo });
    } else if (req.method() === "DELETE") {
      const deleted = photos.filter((p) => p.id === id);
      photos = photos.filter((p) => p.id !== id);
      await route.fulfill({ json: deleted });
    } else if (url.searchParams.has("object_path"))
      await route.fulfill({
        json: photos.filter(
          (p) =>
            p.object_path === url.searchParams.get("object_path")?.slice(3),
        ),
      });
    else await route.fulfill({ json: photos });
  });
  return calls;
}
test("home has functional services and direct routes are accessible", async ({
  page,
}, info) => {
  await gallerySetup(page);
  await page.goto("./");
  await expect(page.locator(".service-card")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "A vida fica mais bonita" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  await page.locator(".service-card").filter({ hasText: "Galeria" }).click();
  await expect(page).toHaveURL(/\/fer-e-gaby\/galeria\//);
  await expect(page.getByRole("article").first()).toContainText(
    "Nosso passeio",
  );
  await expect(
    page.getByRole("button", { name: "Adicionar foto" }),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Ampliar Nosso passeio" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ampliar Nosso passeio" }),
  ).toBeFocused();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.screenshot({
    path: `test-results/${info.project.name}-gallery.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Lista de presentes" })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Início", exact: true })
    .click();
  await expect(page.locator(".service-card")).toHaveCount(2);
});
test("admin uploads compressed photo, edits date, cancels and confirms deletion", async ({
  page,
}) => {
  const calls = await gallerySetup(page, true);
  await page.goto("./galeria/");
  await expect(
    page.getByText("Uma história pronta para ganhar fotos"),
  ).toBeVisible();
  await login(page);
  await page.getByRole("button", { name: "Adicionar foto" }).click();
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByText("Escolha uma foto para enviar.")).toBeVisible();
  await page
    .getByLabel("Foto *", { exact: true })
    .setInputFiles({ name: "bad.gif", mimeType: "image/gif", buffer: image });
  await expect(page.getByRole("alert")).toContainText("JPEG");
  expect(calls.uploads).toBe(0);
  const jpeg = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 3000;
      canvas.height = 4000;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#954f66";
      context.fillRect(0, 0, 3000, 4000);
      return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
    }),
    "base64",
  );
  const exif = Buffer.from(
    "ffe1002245786966000049492a0008000000010012010300010000000600000000000000",
    "hex",
  );
  const phonePhoto = Buffer.concat([
    jpeg.subarray(0, 2),
    exif,
    jpeg.subarray(2),
  ]);
  await page
    .getByLabel("Foto *", { exact: true })
    .setInputFiles({
      name: "celular.jpg",
      mimeType: "image/jpeg",
      buffer: phonePhoto,
    });
  await page
    .getByRole("textbox", { name: "Legenda", exact: true })
    .fill("Um dia feliz");
  await page.getByLabel("Data da foto *").fill("2026-09-15");
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByRole("article")).toContainText("Um dia feliz");
  expect(calls.uploads).toBe(1);
  expect(calls.dimensions).toEqual({ width: 1920, height: 1440 });
  await page.getByRole("button", { name: "Editar foto", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Legenda", exact: true })
    .fill("Dia inesquecível");
  await page.getByLabel("Data da foto *").fill("2024-02-29");
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByRole("article")).toContainText(
    "29 de fevereiro de 2024",
  );
  await page.getByRole("button", { name: "Excluir Dia inesquecível" }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Excluir Dia inesquecível" }).click();
  await page.getByRole("button", { name: "Excluir foto", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Foto excluída do álbum e do armazenamento.",
  );
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(calls.removes).toBe(1);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adicionar foto" }),
  ).toHaveCount(0);
});
test("metadata failure compensates upload and partial deletion remains recoverable", async ({
  page,
}) => {
  const calls = await gallerySetup(page, true, true);
  await page.goto("./galeria/");
  await login(page);
  await page.getByRole("button", { name: "Adicionar foto" }).click();
  await page
    .getByLabel("Foto *", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Data da foto *").fill("2026-09-15");
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "arquivo enviado foi removido",
  );
  expect(calls.removes).toBe(1);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await gallerySetup(page, false, false, true);
  await page.reload();
  await page.getByRole("button", { name: "Excluir Nosso passeio" }).click();
  await page.getByRole("button", { name: "Excluir foto", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "limpeza do arquivo ficou pendente",
  );
  await expect(page.getByRole("article")).toHaveCount(1);
});
test("a signed-in non-admin has no write controls", async ({ page }) => {
  await gallerySetup(page);
  await page.route("**/rest/v1/rpc/is_admin", (r) =>
    r.fulfill({ json: false }),
  );
  await page.goto("./galeria/");
  await page.getByRole("button", { name: "Modo de edição" }).click();
  await page.getByLabel("Senha", { exact: true }).fill("test");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível entrar",
  );
  await expect(
    page.getByRole("button", { name: "Adicionar foto" }),
  ).toHaveCount(0);
});
