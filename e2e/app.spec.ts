import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const fer = "00000000-0000-4000-8000-000000000001",
  gaby = "00000000-0000-4000-8000-000000000002";
const user = {
  id: "8d1f2d09-d1c2-4c7c-ac31-edac11ca8226",
  email: "fernando.greca@integra.do",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-09-01",
};
const lists = [
  { id: fer, slug: "fer", position: 1, display_name: "Lista presentes Fer" },
  { id: gaby, slug: "gaby", position: 2, display_name: "Lista presentes Gaby" },
];
async function setup(page: Page, empty = false) {
  let gifts = empty
    ? []
    : [
        {
          id: "one",
          wishlist_id: fer,
          name: "Livro de memórias",
          product_url: "https://example.com/livro",
          image_url: "",
          price: 50,
          currency: "BRL",
          priority: "high",
          description: "Para guardar bons momentos.",
          notes: "Capa rosa",
          tags: ["livros"],
          status: "wanted",
          created_at: "2026-09-10",
          updated_at: "2026-09-10",
          received_at: null as string | null,
        },
        {
          id: "two",
          wishlist_id: fer,
          name: "Uma caneca",
          product_url: "https://example.com/caneca",
          image_url: "",
          price: 25,
          currency: "BRL",
          priority: "low",
          description: "",
          notes: "",
          tags: ["casa"],
          status: "wanted",
          created_at: "2026-09-11",
          updated_at: "2026-09-11",
          received_at: null as string | null,
        },
        {
          id: "three",
          wishlist_id: gaby,
          name: "Flores para Gaby",
          product_url: "https://example.com/flores",
          image_url: "",
          price: 70,
          currency: "BRL",
          priority: "medium",
          description: "",
          notes: "",
          tags: ["casa"],
          status: "received",
          created_at: "2026-09-11",
          updated_at: "2026-09-11",
          received_at: "2026-09-12",
        },
      ];
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/token"))
      await route.fulfill({
        json: {
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        },
      });
    else if (url.includes("/logout")) await route.fulfill({ status: 204 });
    else await route.fulfill({ json: user });
  });
  await page.route("**/rest/v1/wishlists*", (r) => r.fulfill({ json: lists }));
  await page.route("**/rest/v1/gifts*", async (route) => {
    const req = route.request(),
      id = new URL(req.url()).searchParams.get("id")?.replace("eq.", "");
    if (req.method() === "POST") {
      const next = {
        ...req.postDataJSON(),
        id: "created",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        received_at: null,
      };
      gifts.push(next);
      await route.fulfill({ json: next });
    } else if (req.method() === "PATCH") {
      const item = gifts.find((g) => g.id === id)!;
      Object.assign(item, req.postDataJSON());
      if (item.status === "received")
        item.received_at = new Date().toISOString();
      await route.fulfill({ json: item });
    } else if (req.method() === "DELETE") {
      const item = gifts.find((g) => g.id === id);
      gifts = gifts.filter((g) => g.id !== id);
      await route.fulfill({ json: item });
    } else await route.fulfill({ json: gifts });
  });
  await page.route("**/functions/v1/extract-product", (r) =>
    r.fulfill({
      json: { warnings: ["Esta loja não disponibiliza metadados."] },
    }),
  );
}
async function login(page: Page) {
  await page.getByRole("button", { name: "Modo de edição" }).click();
  await page.getByLabel("Senha", { exact: true }).fill("mock-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Novo presente" }),
  ).toBeVisible();
}
test("public lists, combined filters, history and accessible layout", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.goto("./");
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
test("admin create, failed extraction, edit, receive, delete and logout", async ({
  page,
}) => {
  await setup(page, true);
  await page.goto("./");
  await login(page);
  await page.getByRole("button", { name: "Novo presente" }).click();
  await page
    .getByLabel("Link do produto *")
    .fill("https://example.com/produto");
  await page.getByRole("button", { name: "Preencher pelo link" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Preenchimento parcial" }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByRole("button", { name: "Novo presente" })).toHaveCount(
    0,
  );
});
test("login keyboard focus, validation, and API failure states", async ({
  page,
}) => {
  await setup(page);
  await page.goto("./");
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
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.route("**/rest/v1/gifts*", (r) =>
    r.fulfill({ status: 503, json: { message: "Unavailable" } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Nosso cantinho está indisponível" }),
  ).toBeVisible({ timeout: 25000 });
});
