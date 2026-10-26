import { z } from "zod";
import { httpUrl } from "./gifts";

export const PLACE_BUCKET = "places-photos";
export const PLACE_CATEGORIES = [
  "Restaurante",
  "Parque e natureza",
  "Cidade",
  "País",
  "Evento",
  "Passeio e atração",
  "Museu",
  "Hospedagem",
  "Compras",
  "Outro",
] as const;
export const placeStatuses = {
  planned: "Queremos ir",
  visited: "Já fomos",
} as const;

const optionalDate = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value < "1900-01-01" || value > "2100-12-31") return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");

export const placeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do lugar.").max(200),
  category: z.enum(PLACE_CATEGORIES),
  description: z.string().trim().max(3000),
  location: z.string().trim().max(300),
  address: z.string().trim().max(500),
  map_url: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => !value || httpUrl(value), "Informe um link HTTP ou HTTPS válido."),
  website_url: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => !value || httpUrl(value), "Informe um link HTTP ou HTTPS válido."),
  event_date: optionalDate,
  status: z.enum(["planned", "visited"]),
  visited_date: optionalDate,
});
export type PlaceInput = z.infer<typeof placeSchema>;
export type Place = Omit<PlaceInput, "event_date" | "visited_date"> & {
  id: string;
  event_date: string | null;
  visited_date: string | null;
  created_at: string;
  updated_at: string;
  photos: PlacePhoto[];
};
export type PlacePhoto = {
  id: string;
  place_id: string;
  object_path: string;
  is_cover: boolean;
  created_at: string;
};

export function validatePlaceImage(file: Pick<File, "type" | "size">) {
  if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type))
    throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  if (file.size === 0 || file.size > 20 * 1024 * 1024)
    throw new Error("Escolha uma imagem de até 20 MB que não esteja vazia.");
}

export function placePayload(input: PlaceInput) {
  const value = placeSchema.parse(input);
  return {
    ...value,
    event_date: value.event_date || null,
    visited_date: value.status === "visited" ? value.visited_date || null : null,
  };
}

export function placeImagePath(path: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:webp|jpg)$/.test(path);
}
