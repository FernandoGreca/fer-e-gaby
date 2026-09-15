import { expect, type Page } from "@playwright/test";
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
export async function setup(page: Page, empty = false) {
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
  await page.route("**/rest/v1/rpc/is_admin", (r) => r.fulfill({ json: true }));
}
export async function login(page: Page) {
  await page.getByRole("button", { name: "Modo de edição" }).click();
  await page.getByLabel("Senha", { exact: true }).fill("mock-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
}
