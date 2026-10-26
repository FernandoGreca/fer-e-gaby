import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup, login } from "./helpers";
test("public lists, combined filters, history and accessible layout", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.goto("./presentes/");
  await expect(
    page.getByRole("heading", { name: "Livro de memórias" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo presente" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(page.getByRole("article").first()).toContainText(
    "Livro de memórias",
  );
  await expect(
    page.getByRole("link", { name: "Ver na loja" }).first(),
  ).toHaveAttribute("rel", "noopener noreferrer");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Prioridade", exact: true })
    .selectOption("high");
  await page.getByLabel("Preço mínimo").fill("40");
  await page.getByLabel("Preço máximo").fill("60");
  await page
    .getByRole("combobox", { name: "Etiqueta", exact: true })
    .selectOption("livros");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  await page.getByRole("button", { name: "Já ganhamos" }).click();
  await page.getByRole("tab", { name: "Lista presentes Gaby" }).click();
  await expect(
    page.getByRole("heading", { name: "Flores para Gaby" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-history.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Livro de memórias" }),
  ).toBeVisible();
});
test("admin manual create, edit, receive, delete and logout", async ({
  page,
}) => {
  let edgeRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/functions/")) edgeRequests++;
  });
  await setup(page, true);
  await page.goto("./presentes/");
  await login(page);
  await page.getByRole("button", { name: "Novo presente" }).click();
  await page.getByLabel("Link do produto *").evaluate((input) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "https://example.com/colado");
    input.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData }),
    );
  });
  await page
    .getByLabel("Link do produto *")
    .fill("https://example.com/produto");
  await expect(page.getByLabel("Nome do presente *")).toHaveValue("");
  await expect(page.getByLabel("Preço", { exact: true })).toHaveValue("");
  await page.getByLabel("Link do produto *").pressSequentially("?manual=1");
  await page.getByLabel("Nome do presente *").fill("Presente de teste");
  await page.getByLabel("Preço", { exact: true }).fill("99,90");
  await page.getByLabel("Etiquetas", { exact: true }).fill("Casa, casa");
  await page.getByRole("button", { name: "Salvar presente" }).click();
  await expect(
    page.getByRole("heading", { name: "Presente de teste" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nome do presente *").fill("Presente editado");
  await page.getByRole("button", { name: "Salvar presente" }).click();
  await expect(
    page.getByRole("heading", { name: "Presente editado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ganhei", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Presente editado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ganhei", exact: true }).click();
  await page.getByRole("button", { name: "Sim, ganhei!" }).click();
  await expect(
    page.getByRole("heading", { name: "Presente editado" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Já ganhamos" }).click();
  await expect(
    page.getByRole("heading", { name: "Presente editado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Excluir Presente editado" }).click();
  await page
    .getByRole("button", { name: "Excluir presente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Presente editado" }),
  ).toHaveCount(0);
  expect(edgeRequests).toBe(0);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByRole("button", { name: "Novo presente" })).toHaveCount(
    0,
  );
});
test("login keyboard focus, validation, and API failure states", async ({
  page,
}) => {
  await setup(page);
  await page.goto("./presentes/");
  await page.getByRole("button", { name: "Modo de edição" }).click();
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await login(page);
  await page.getByRole("button", { name: "Novo presente" }).click();
  await page.getByRole("button", { name: "Salvar presente" }).click();
  await expect(page.getByText("Informe o nome.")).toBeVisible();
  await expect(
    page.getByText("Informe um link HTTP ou HTTPS válido, sem credenciais."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.route("**/rest/v1/gifts*", (r) =>
    r.fulfill({ status: 503, json: { message: "Unavailable" } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Nosso cantinho está indisponível" }),
  ).toBeVisible({ timeout: 25000 });
});

test("places page searches and filters public destinations", async ({ page }) => {
  await setup(page);
  const places = [
    {
      id: "place-one",
      name: "Parque das Flores",
      category: "Parque e natureza",
      description: "Um passeio ao ar livre.",
      location: "São Paulo",
      address: "Av. Exemplo, 10",
      map_url: "https://maps.example.com/parque",
      website_url: "",
      event_date: null,
      status: "planned",
      visited_date: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "place-two",
      name: "Festival da Cidade",
      category: "Evento",
      description: "Música e comida boa.",
      location: "Campinas",
      address: "Centro",
      map_url: "",
      website_url: "",
      event_date: "2026-11-01",
      status: "visited",
      visited_date: "2026-10-10",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-10-10T00:00:00Z",
    },
  ];
  const photos = [
    {
      id: "photo-one",
      place_id: "place-one",
      object_path: "00000000-0000-4000-8000-000000000001.webp",
      is_cover: true,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "photo-two",
      place_id: "place-two",
      object_path: "00000000-0000-4000-8000-000000000002.webp",
      is_cover: true,
      created_at: "2026-09-01T00:00:00Z",
    },
  ];
  await page.route("**/rest/v1/places?**", (route) =>
    route.fulfill({ json: places }),
  );
  await page.route("**/rest/v1/place_photos?**", (route) =>
    route.fulfill({ json: photos }),
  );
  await page.route("**/storage/v1/object/public/places-photos/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S4sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("./lugares/");
  await expect(
    page.getByRole("heading", { name: "Parque das Flores" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Festival da Cidade" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Adicionar lugar" })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Buscar lugares" }).fill("flores");
  await expect(
    page.getByRole("heading", { name: "Parque das Flores" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Festival da Cidade" }),
  ).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Buscar lugares" }).clear();
  await page
    .getByRole("combobox", { name: "Filtrar por estado" })
    .selectOption("visited");
  await expect(
    page.getByRole("heading", { name: "Festival da Cidade" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Parque das Flores" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /Ver fotos de Festival da Cidade/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Visitamos em 10 de outubro de 2026",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("admin creates, edits, chooses cover photos, and deletes a place", async ({
  page,
}) => {
  await setup(page, true);
  const places: Record<string, unknown>[] = [];
  const photos: Record<string, unknown>[] = [];
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGOY6p+GFTEMLQkASGhSgVK7IqwAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/rest/v1/places?**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.searchParams.get("id")?.replace("eq.", "");
    if (request.method() === "POST") {
      const record = {
        ...request.postDataJSON(),
        id: "place-created",
        created_at: "2026-10-26T10:00:00Z",
        updated_at: "2026-10-26T10:00:00Z",
      };
      places.push(record);
      await route.fulfill({ json: record });
    } else if (request.method() === "PATCH") {
      const record = places.find((place) => place.id === id)!;
      Object.assign(record, request.postDataJSON());
      await route.fulfill({ json: record });
    } else if (request.method() === "DELETE") {
      const deleted = places.find((place) => place.id === id);
      places.splice(places.findIndex((place) => place.id === id), 1);
      for (let index = photos.length - 1; index >= 0; index--)
        if (photos[index].place_id === id) photos.splice(index, 1);
      await route.fulfill({ json: deleted });
    } else await route.fulfill({ json: places });
  });
  await page.route("**/rest/v1/place_photos?**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.searchParams.get("id")?.replace("eq.", "");
    if (request.method() === "POST") {
      const record = {
        ...request.postDataJSON(),
        id: `photo-${photos.length + 1}`,
        created_at: "2026-10-26T10:00:00Z",
      };
      photos.push(record);
      await route.fulfill({ json: record });
    } else if (request.method() === "PATCH") {
      for (const photo of photos) {
        if (photo.place_id === url.searchParams.get("place_id")?.replace("eq.", ""))
          Object.assign(photo, request.postDataJSON());
        if (photo.id === id) Object.assign(photo, request.postDataJSON());
      }
      await route.fulfill({ status: 204, body: "" });
    } else if (request.method() === "DELETE") {
      const index = photos.findIndex((photo) => photo.id === id);
      if (index >= 0) photos.splice(index, 1);
      await route.fulfill({ status: 204, body: "" });
    } else await route.fulfill({ json: photos });
  });
  await page.route("**/rest/v1/place_photo_cleanup*", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.route("**/storage/v1/object/**", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({ json: { Key: "places-photos/upload.webp" } });
    else if (route.request().method() === "DELETE")
      await route.fulfill({ json: [] });
    else
      await route.fulfill({ contentType: "image/png", body: png });
  });
  await page.goto("./lugares/");
  await login(page);
  await page.getByRole("button", { name: "Adicionar lugar" }).click();
  await page.getByLabel("Nome do lugar *").fill("Parque de teste");
  await page.getByLabel("Categoria *").selectOption("Parque e natureza");
  await page.getByLabel("Cidade ou país").fill("São Paulo");
  await page.getByLabel("Fotos *").setInputFiles([
    { name: "parque-a.png", mimeType: "image/png", buffer: png },
    { name: "parque-b.png", mimeType: "image/png", buffer: png },
  ]);
  await page.getByRole("button", { name: "Salvar lugar" }).click();
  await expect(
    page.getByRole("heading", { name: "Parque de teste" }),
  ).toBeVisible();
  await expect(page.getByText("2 fotos")).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nome do lugar *").fill("Parque editado");
  await page.getByRole("button", { name: /Usar foto existente/ }).nth(1).click();
  await page.getByRole("button", { name: "Salvar lugar" }).click();
  await expect(
    page.getByRole("heading", { name: "Parque editado" }),
  ).toBeVisible();
  expect(photos.filter((photo) => photo.is_cover)).toHaveLength(1);
  await page.getByRole("button", { name: "Excluir Parque editado" }).click();
  await page.getByRole("button", { name: "Excluir lugar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Parque editado" }),
  ).toHaveCount(0);
  expect(places).toHaveLength(0);
  expect(photos).toHaveLength(0);
});
