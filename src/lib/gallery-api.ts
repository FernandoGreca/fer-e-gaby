import { supabase } from "./supabase";
import {
  GALLERY_BUCKET,
  validObjectPath,
  type Photo,
  type PhotoInput,
} from "./gallery";
const bucket = () => supabase.storage.from(GALLERY_BUCKET);
export function photoUrl(path: string) {
  return validObjectPath(path)
    ? bucket().getPublicUrl(path).data.publicUrl
    : "";
}
export async function listPhotos() {
  const photos: Photo[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("gallery_photos")
      .select("*")
      .order("photo_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    photos.push(...(data as Photo[]));
    if (data.length < 1000) return photos;
  }
}
export async function cleanObject(path: string) {
  if (!validObjectPath(path)) throw new Error("Caminho de imagem inválido.");
  const linked = await supabase
    .from("gallery_photos")
    .select("id")
    .eq("object_path", path);
  if (linked.error) throw linked.error;
  if (linked.data.length)
    throw new Error(
      "A foto já está salva na galeria. Atualize a página para conferir.",
    );
  const { error } = await bucket().remove([path]);
  if (error) throw error;
  // Storage can return success with no deletion when RLS filters a row. Confirm absence first.
  const check = await bucket().list("", { search: path, limit: 1 });
  if (check.error || check.data.some((file) => file.name === path))
    throw new Error("A limpeza do arquivo ainda não foi concluída.");
  const result = await supabase
    .from("gallery_cleanup")
    .delete()
    .eq("object_path", path);
  if (result.error) throw result.error;
}
export async function uploadPhoto(
  blob: Blob,
  input: PhotoInput,
  onStatus: (s: string) => void,
) {
  const path = crypto.randomUUID() + ".webp";
  const intent = await supabase
    .from("gallery_cleanup")
    .insert({ object_path: path });
  if (intent.error)
    throw new Error(
      "Não foi possível preparar o envio. Confira sua sessão e tente novamente.",
    );
  try {
    onStatus("Enviando foto…");
    const upload = await bucket().upload(path, blob, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (upload.error) throw upload.error;
    onStatus("Salvando os detalhes…");
    const result = await supabase
      .from("gallery_photos")
      .insert({ ...input, object_path: path })
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data as Photo;
  } catch {
    try {
      await cleanObject(path);
    } catch {
      throw new Error(
        "O envio não pôde ser confirmado. Confira a galeria. Se a foto não aparecer, a limpeza ficou registrada e poderá ser retomada em 15 minutos.",
      );
    }
    throw new Error(
      "Não foi possível salvar a foto. O arquivo enviado foi removido; tente novamente.",
    );
  }
}
export async function editPhoto(id: string, input: PhotoInput) {
  const { data, error } = await supabase
    .from("gallery_photos")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Photo;
}
export async function deletePhoto(photo: Photo) {
  // The database trigger records cleanup atomically with deletion, so a reload cannot lose it.
  const result = await supabase
    .from("gallery_photos")
    .delete()
    .eq("id", photo.id)
    .select();
  if (result.error)
    throw new Error("Não foi possível excluir a foto. Tente novamente.");
  try {
    await cleanObject(photo.object_path);
    return { pending: false };
  } catch {
    return { pending: true };
  }
}
export async function listCleanup() {
  // Do not interfere with an upload in progress in another tab/device.
  const { data, error } = await supabase
    .from("gallery_cleanup")
    .select("object_path")
    .lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .order("created_at")
    .limit(100);
  if (error) throw error;
  return data as { object_path: string }[];
}
