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
