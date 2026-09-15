import { z } from "zod";
export const GALLERY_BUCKET = "couple-gallery";
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DIMENSION = 1920;
export const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const photoSchema = z.object({
  caption: z.string().trim().max(1000, "Use no máximo 1.000 caracteres."),
  photo_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da foto.")
    .refine((value) => {
      const date = new Date(value + "T12:00:00Z");
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        value >= "1900-01-01" &&
        value <= "2100-12-31"
      );
    }, "Informe uma data válida entre 1900 e 2100."),
});
export type PhotoInput = z.infer<typeof photoSchema>;
export type Photo = PhotoInput & {
  id: string;
  object_path: string;
  created_at: string;
  updated_at: string;
};
export function validateImage(file: Pick<File, "type" | "size">) {
  if (!allowedImageTypes.includes(file.type))
    throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  if (file.size === 0 || file.size > MAX_ORIGINAL_BYTES)
    throw new Error("Escolha uma imagem de até 20 MB que não esteja vazia.");
}
export function imageDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("A imagem não possui dimensões válidas.");
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function validObjectPath(path: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(
    path,
  );
}
export function sortPhotos(photos: Photo[]) {
  return [...photos].sort(
    (a, b) =>
      b.photo_date.localeCompare(a.photo_date) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
}
export function photoDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export async function compressImage(file: File): Promise<Blob> {
  validateImage(file);
  // The browser applies EXIF orientation while decoding. Drawing to a new canvas strips metadata.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => {
    throw new Error(
      "Não foi possível abrir a imagem. Escolha outro arquivo JPEG, PNG ou WebP válido.",
    );
  });
  try {
    const size = imageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Este navegador não conseguiu processar a imagem.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Não foi possível comprimir a imagem.")),
        "image/webp",
        0.82,
      ),
    );
    if (blob.type !== "image/webp")
      throw new Error(
        "Este navegador não consegue gerar WebP. Tente um navegador atualizado.",
      );
    if (blob.size > MAX_UPLOAD_BYTES)
      throw new Error(
        "A foto processada excedeu 5 MB. Escolha uma imagem menor.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
