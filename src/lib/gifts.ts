import { z } from "zod";
export const priorities = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
} as const;
export function httpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function normalizeTags(value: string | string[]) {
  return [
    ...new Set(
      (typeof value === "string" ? value.split(",") : value)
        .map((tag) => tag.trim().toLocaleLowerCase("pt-BR"))
        .filter(Boolean),
    ),
  ];
}
export const giftSchema = z.object({
  wishlist_id: z.uuid("Selecione uma lista."),
  name: z.string().trim().min(1, "Informe o nome.").max(200),
  product_url: z
    .string()
    .trim()
    .max(2048)
    .refine(httpUrl, "Informe um link HTTP ou HTTPS válido, sem credenciais."),
  image_url: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => !v || httpUrl(v), "Informe uma URL de imagem válida."),
  price: z
    .string()
    .refine(
      (v) => !v || /^\d{1,10}([.,]\d{1,2})?$/.test(v),
      "Use um preço positivo com até duas casas decimais.",
    ),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use três letras, como BRL."),
  priority: z.enum(["high", "medium", "low"]),
  description: z.string().max(4000),
  notes: z.string().max(2000),
  tags: z
    .string()
    .max(600)
    .refine(
      (v) =>
        normalizeTags(v).length <= 20 &&
        normalizeTags(v).every((t) => t.length <= 40),
      "Use até 20 etiquetas de até 40 caracteres.",
    ),
  status: z.enum(["wanted", "received"]),
});
export type GiftInput = z.infer<typeof giftSchema>;
export type Wishlist = {
  id: string;
  slug: string;
  display_name: string;
  position: number;
};
export type Gift = Omit<GiftInput, "price" | "tags"> & {
  id: string;
  price: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  received_at: string | null;
};
export type Filters = {
  priority: string;
  min: string;
  max: string;
  tag: string;
};
export const emptyFilters: Filters = {
  priority: "",
  min: "",
  max: "",
  tag: "",
};
export function selectGifts(
  gifts: Gift[],
  listId: string,
  history: boolean,
  filters: Filters,
) {
  const rank = { high: 0, medium: 1, low: 2 };
  return gifts
    .filter(
      (g) =>
        g.wishlist_id === listId &&
        g.status === (history ? "received" : "wanted") &&
        (!filters.priority || g.priority === filters.priority) &&
        (!filters.tag || g.tags.includes(filters.tag)) &&
        (!filters.min ||
          (g.price !== null && g.price >= Number(filters.min))) &&
        (!filters.max || (g.price !== null && g.price <= Number(filters.max))),
    )
    .sort((a, b) =>
      history
        ? (b.received_at ?? "").localeCompare(a.received_at ?? "")
        : rank[a.priority] - rank[b.priority] ||
          b.created_at.localeCompare(a.created_at),
    );
}
export function giftPayload(input: GiftInput) {
  const v = giftSchema.parse(input);
  return {
    ...v,
    price: v.price ? Number(v.price.replace(",", ".")) : null,
    tags: normalizeTags(v.tags),
    image_url: v.image_url || null,
  };
}
export function money(price: number | null, currency: string) {
  if (price === null) return "Preço a consultar";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}
