import { supabase } from "./supabase";
import {
  PLACE_BUCKET,
  placeImagePath,
  placePayload,
  type Place,
  type PlaceInput,
  type PlacePhoto,
} from "./places";

const bucket = () => supabase.storage.from(PLACE_BUCKET);
export function placePhotoUrl(path: string) {
  return placeImagePath(path) ? bucket().getPublicUrl(path).data.publicUrl : "";
}

export async function listPlaces() {
  const { data: places, error } = await supabase
    .from("places")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  const { data: photos, error: photoError } = await supabase
    .from("place_photos")
    .select("*")
    .order("created_at");
  if (photoError) throw photoError;
  return (places ?? []).map((place) => ({
    ...place,
    photos: (photos ?? []).filter((photo) => photo.place_id === place.id),
  })) as Place[];
}

export async function createPlace(input: PlaceInput) {
  const { data, error } = await supabase
    .from("places")
    .insert(placePayload(input))
    .select()
    .single();
  if (error) throw error;
  return data as Omit<Place, "photos">;
}

export async function editPlace(id: string, input: PlaceInput) {
  const { data, error } = await supabase
    .from("places")
    .update(placePayload(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function removeUnlinkedObject(path: string) {
  if (!placeImagePath(path)) throw new Error("Caminho da imagem inválido.");
  const linked = await supabase.from("place_photos").select("id").eq("object_path", path);
  if (linked.error) throw linked.error;
  if (linked.data.length) return;
  const removed = await bucket().remove([path]);
  if (removed.error) throw removed.error;
  const check = await bucket().list("", { search: path, limit: 1 });
  if (check.error || check.data.some((file) => file.name === path))
    throw new Error("A limpeza do arquivo ainda não foi concluída.");
  const cleanup = await supabase
    .from("place_photo_cleanup")
    .delete()
    .eq("object_path", path);
  if (cleanup.error) throw cleanup.error;
}

export async function addPlacePhoto(placeId: string, blob: Blob, isCover: boolean) {
  const path = `${crypto.randomUUID()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
  const intent = await supabase.from("place_photo_cleanup").insert({ object_path: path });
  if (intent.error) throw new Error("Não foi possível preparar o envio da imagem.");
  const uploaded = await bucket().upload(path, blob, {
    contentType: blob.type === "image/webp" ? "image/webp" : "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploaded.error) {
    await removeUnlinkedObject(path);
    throw new Error("Não foi possível enviar a imagem. Confira a conexão e tente novamente.");
  }
  const result = await supabase
    .from("place_photos")
    .insert({ place_id: placeId, object_path: path, is_cover: isCover })
    .select()
    .single();
  if (result.error) {
    await removeUnlinkedObject(path);
    throw new Error("A imagem foi enviada, mas não pôde ser vinculada ao lugar.");
  }
  return result.data as PlacePhoto;
}

export async function setPlaceCover(photo: PlacePhoto) {
  const unset = await supabase
    .from("place_photos")
    .update({ is_cover: false })
    .eq("place_id", photo.place_id)
    .eq("is_cover", true);
  if (unset.error) throw unset.error;
  const set = await supabase.from("place_photos").update({ is_cover: true }).eq("id", photo.id);
  if (set.error) throw set.error;
}

export async function deletePlacePhoto(photo: PlacePhoto) {
  const result = await supabase.from("place_photos").delete().eq("id", photo.id);
  if (result.error) throw result.error;
  try {
    await removeUnlinkedObject(photo.object_path);
    return { pending: false };
  } catch {
    return { pending: true };
  }
}

export async function deletePlace(place: Place) {
  const result = await supabase.from("places").delete().eq("id", place.id);
  if (result.error) throw result.error;
  let pending = false;
  for (const photo of place.photos) {
    try {
      await removeUnlinkedObject(photo.object_path);
    } catch {
      pending = true;
    }
  }
  return { pending };
}

export async function listPlaceCleanup() {
  const { data, error } = await supabase
    .from("place_photo_cleanup")
    .select("object_path")
    .lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .order("created_at")
    .limit(100);
  if (error) throw error;
  return data as { object_path: string }[];
}

export async function cleanPlaceObject(path: string) {
  await removeUnlinkedObject(path);
}
