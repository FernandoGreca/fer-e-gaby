/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ExternalLink,
  Heart,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "./modal";
import { useAuth } from "./portal";
import { compressImage } from "@/lib/gallery";
import {
  PLACE_CATEGORIES,
  placeStatuses,
  placeSchema,
  validatePlaceImage,
  type Place,
  type PlaceInput,
  type PlacePhoto,
} from "@/lib/places";
import {
  addPlacePhoto,
  cleanPlaceObject,
  createPlace,
  deletePlace,
  deletePlacePhoto,
  editPlace,
  listPlaces,
  listPlaceCleanup,
  placePhotoUrl,
  setPlaceCover,
} from "@/lib/places-api";

const emptyInput: PlaceInput = {
  name: "",
  category: "Restaurante",
  description: "",
  location: "",
  address: "",
  map_url: "",
  website_url: "",
  event_date: "",
  status: "planned",
  visited_date: "",
};

function displayDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function PlaceForm({
  place,
  onClose,
  onSave,
}: {
  place?: Place;
  onClose: () => void;
  onSave: (
    input: PlaceInput,
    files: File[],
    keptPhotos: PlacePhoto[],
    coverPhotoId: string | null,
    newCoverIndex: number,
  ) => Promise<void>;
}) {
  const [input, setInput] = useState<PlaceInput>(
    place
      ? {
          name: place.name,
          category: place.category,
          description: place.description,
          location: place.location,
          address: place.address,
          map_url: place.map_url,
          website_url: place.website_url,
          event_date: place.event_date ?? "",
          status: place.status,
          visited_date: place.visited_date ?? "",
        }
      : emptyInput,
  );
  const [keptPhotos, setKeptPhotos] = useState(place?.photos ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [coverPhotoId, setCoverPhotoId] = useState(
    place?.photos.find((photo) => photo.is_cover)?.id ?? null,
  );
  const [newCoverIndex, setNewCoverIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const fileUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => fileUrls.forEach((url) => URL.revokeObjectURL(url)), [fileUrls]);

  function change<K extends keyof PlaceInput>(key: K, value: PlaceInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = placeSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (!place && files.length === 0) {
      setError("Adicione pelo menos uma foto do lugar.");
      return;
    }
    if (keptPhotos.length + files.length === 0) {
      setError("Mantenha ou adicione pelo menos uma foto do lugar.");
      return;
    }
    setBusy(true);
    try {
      await onSave(
        parsed.data,
        files,
        keptPhotos,
        coverPhotoId,
        Math.min(newCoverIndex, Math.max(files.length - 1, 0)),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar. Confira a conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <Modal
      title={place ? "Editar lugar" : "Adicionar lugar"}
      description="Registre um destino especial e as fotos que ajudam a lembrar dele."
      className="place-modal"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form noValidate onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="place-form-grid">
            <label className="field">
              Nome do lugar *
              <input
                required
                maxLength={200}
                value={input.name}
                onChange={(event) => change("name", event.target.value)}
              />
            </label>
            <label className="field">
              Categoria *
              <select
                value={input.category}
                onChange={(event) =>
                  change("category", event.target.value as PlaceInput["category"])
                }
              >
                {PLACE_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="field full-width">
              Descrição
              <textarea
                rows={3}
                maxLength={3000}
                value={input.description}
                onChange={(event) => change("description", event.target.value)}
                placeholder="O que queremos conhecer por lá?"
              />
            </label>
            <label className="field">
              Cidade ou país
              <input
                maxLength={300}
                value={input.location}
                onChange={(event) => change("location", event.target.value)}
              />
            </label>
            <label className="field">
              Endereço ou referência
              <input
                maxLength={500}
                value={input.address}
                onChange={(event) => change("address", event.target.value)}
              />
            </label>
            <label className="field">
              Link do mapa
              <input
                type="url"
                maxLength={2048}
                value={input.map_url}
                onChange={(event) => change("map_url", event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className="field">
              Site ou ingresso
              <input
                type="url"
                maxLength={2048}
                value={input.website_url}
                onChange={(event) => change("website_url", event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className="field">
              Data do evento (opcional)
              <input
                type="date"
                value={input.event_date}
                onChange={(event) => change("event_date", event.target.value)}
              />
            </label>
            <label className="field">
              Estado
              <select
                value={input.status}
                onChange={(event) =>
                  change("status", event.target.value as PlaceInput["status"])
                }
              >
                <option value="planned">Queremos ir</option>
                <option value="visited">Já fomos</option>
              </select>
            </label>
            {input.status === "visited" && (
              <label className="field">
                Data da visita (opcional)
                <input
                  type="date"
                  value={input.visited_date}
                  onChange={(event) => change("visited_date", event.target.value)}
                />
              </label>
            )}
          </div>
          <label className="field">
            Fotos *
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setError("");
                const selected = Array.from(event.target.files ?? []);
                try {
                  selected.forEach(validatePlaceImage);
                  setFiles((current) => [...current, ...selected]);
                } catch (fileError) {
                  setError((fileError as Error).message);
                }
                event.target.value = "";
              }}
            />
            <span className="helper">
              JPEG, PNG ou WebP, até 20 MB cada. Selecione várias fotos de uma vez ou adicione mais depois.
            </span>
          </label>
          {(keptPhotos.length > 0 || files.length > 0) && (
            <>
              <p className="helper">Escolha qual imagem será a capa.</p>
              <div className="place-thumbnails">
                {keptPhotos.map((photo) => (
                  <div key={photo.id} className="place-thumbnail-wrap">
                    <button
                      type="button"
                      className={`place-thumbnail ${coverPhotoId === photo.id ? "selected" : ""}`}
                      aria-label={`Usar foto existente ${coverPhotoId === photo.id ? "como capa" : ""}`}
                      aria-pressed={coverPhotoId === photo.id}
                      onClick={() => setCoverPhotoId(photo.id)}
                    >
                      <img src={placePhotoUrl(photo.object_path)} alt="" />
                      {coverPhotoId === photo.id && (
                        <span className="place-photo-controls">Capa</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="remove-photo"
                      aria-label="Remover esta foto"
                      onClick={() => {
                        const remaining = keptPhotos.filter((item) => item.id !== photo.id);
                        setKeptPhotos(remaining);
                        if (coverPhotoId === photo.id)
                          setCoverPhotoId(remaining[0]?.id ?? null);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {files.map((file, index) => (
                  <div className="place-file-preview" key={`${file.name}-${index}`}>
                    <button
                      type="button"
                      className={`place-thumbnail ${coverPhotoId === null && newCoverIndex === index ? "selected" : ""}`}
                      aria-label={`Usar ${file.name} ${coverPhotoId === null && newCoverIndex === index ? "como capa" : ""}`}
                      aria-pressed={coverPhotoId === null && newCoverIndex === index}
                      onClick={() => {
                        setCoverPhotoId(null);
                        setNewCoverIndex(index);
                      }}
                    >
                      <img src={fileUrls[index]} alt="" />
                      {coverPhotoId === null && newCoverIndex === index && (
                        <span className="place-photo-controls">Capa</span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover ${file.name}`}
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {status && <p role="status" className="gallery-notice">{status}</p>}
          {error && <p role="alert" className="field-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="button" disabled={busy}>
              {busy ? "Salvando…" : "Salvar lugar"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function PlaceDetails({ place, onClose }: { place: Place; onClose: () => void }) {
  return (
    <Modal
      title={place.name}
      description={`${place.category} · ${placeStatuses[place.status]}`}
      className="place-modal"
      onClose={onClose}
    >
      <div className="place-details-photos">
        {place.photos.map((photo) => (
          <img key={photo.id} src={placePhotoUrl(photo.object_path)} alt={`Foto de ${place.name}`} />
        ))}
      </div>
      {place.description && <p className="place-description">{place.description}</p>}
      {(place.location || place.address) && (
        <p className="place-location"><MapPin size={15} /> {[place.address, place.location].filter(Boolean).join(" · ")}</p>
      )}
      {place.event_date && <p className="place-date"><CalendarDays size={15} /> Evento: {displayDate(place.event_date)}</p>}
      {place.visited_date && <p className="place-date"><CalendarDays size={15} /> Visitamos em {displayDate(place.visited_date)}</p>}
      <div className="place-card-links">
        {place.map_url && <a href={place.map_url} target="_blank" rel="noreferrer">Abrir mapa <ExternalLink size={14} /></a>}
        {place.website_url && <a href={place.website_url} target="_blank" rel="noreferrer">Site ou ingresso <ExternalLink size={14} /></a>}
      </div>
    </Modal>
  );
}

export function PlacesApp() {
  const admin = useAuth().admin;
  const client = useQueryClient();
  const places = useQuery({ queryKey: ["places"], queryFn: listPlaces });
  const cleanup = useQuery({
    queryKey: ["place-photo-cleanup"],
    queryFn: listPlaceCleanup,
    enabled: admin,
    refetchInterval: 60000,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<Place | "new" | null>(null);
  const [details, setDetails] = useState<Place | null>(null);
  const [confirm, setConfirm] = useState<Place | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return (places.data ?? []).filter((place) => {
      const matchesText = !query || [place.name, place.location, place.description]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(query));
      return matchesText && (!category || place.category === category) && (!status || place.status === status);
    });
  }, [places.data, search, category, status]);

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["places"] }),
      client.invalidateQueries({ queryKey: ["place-photo-cleanup"] }),
    ]);
  }

  async function save(
    input: PlaceInput,
    files: File[],
    keptPhotos: PlacePhoto[],
    coverPhotoId: string | null,
    newCoverIndex: number,
  ) {
    setError("");
    const existing = editor !== "new" ? editor : undefined;
    const place = existing
      ? await editPlace(existing.id, input)
      : await createPlace(input);
    setProgress("Atualizando fotos…");
    const remainingIds = new Set(keptPhotos.map((photo) => photo.id));
    let hasPendingCleanup = false;
    for (const photo of existing?.photos ?? []) {
      if (!remainingIds.has(photo.id)) {
        const result = await deletePlacePhoto(photo);
        hasPendingCleanup ||= result.pending;
      }
    }
    const added: PlacePhoto[] = [];
    for (let index = 0; index < files.length; index++) {
      setProgress(`Preparando foto ${index + 1} de ${files.length}…`);
      const blob = await compressImage(files[index]);
      added.push(await addPlacePhoto(place.id, blob, false));
    }
    const selectedCover = coverPhotoId
      ? keptPhotos.find((photo) => photo.id === coverPhotoId)
      : added[newCoverIndex] ?? added[0];
    if (selectedCover) await setPlaceCover(selectedCover);
    setEditor(null);
    setMessage(
      hasPendingCleanup
        ? "Lugar salvo. A limpeza de uma foto ficou pendente e poderá ser retomada em 15 minutos."
        : "Lugar salvo com carinho.",
    );
    await refresh();
  }

  async function remove(place: Place) {
    try {
      setError("");
      const result = await deletePlace(place);
      setConfirm(null);
      setMessage(
        result.pending
          ? "Lugar excluído. A limpeza de algumas fotos ficou pendente e poderá ser retomada em 15 minutos."
          : "Lugar e fotos excluídos.",
      );
      await refresh();
    } catch {
      setError("Não foi possível excluir o lugar. Tente novamente.");
    }
  }

  return (
    <main id="conteudo">
      <section className="hero">
        <span className="eyebrow"><span /> DESTINOS E EXPERIÊNCIAS <span /></span>
        <h1>Lugares para ir,<br /><em>histórias para viver.</em></h1>
        <p>Uma coleção de destinos, passeios e momentos que queremos descobrir juntos.</p>
        <div className="hero-heart"><Heart size={17} /><span>cada lugar, um novo capítulo</span></div>
      </section>
      <section className="gallery-section" aria-label="Lugares para ir">
        <div className="list-heading">
          <div>
            <span className="eyebrow">NOSSA LISTA DE PLANOS</span>
            <h2>Lugares especiais <span className="count">{shown.length}</span></h2>
          </div>
          {admin && <button className="button" onClick={() => { setError(""); setEditor("new"); }}><Plus size={17} /> Adicionar lugar</button>}
        </div>
        {message && <p className="gallery-notice" role="status">{message}</p>}
        {error && !confirm && <p className="error-banner" role="alert">{error}</p>}
        {admin && cleanup.isError && <p role="alert" className="error-banner">Não foi possível consultar a limpeza pendente. <button className="text-button" onClick={() => void cleanup.refetch()}>Tentar novamente</button></p>}
        {admin && !!cleanup.data?.length && <div className="form-callout"><p>Há imagens de operações interrompidas aguardando limpeza.</p><button className="button secondary" disabled={cleaning} onClick={async () => { setCleaning(true); try { for (const item of cleanup.data ?? []) await cleanPlaceObject(item.object_path); setMessage("Limpeza das imagens concluída."); await refresh(); } catch { setError("A limpeza ainda não foi concluída. Os arquivos continuam registrados para uma nova tentativa."); } finally { setCleaning(false); } }}>{cleaning ? "Limpando…" : "Retomar limpeza"}</button></div>}
        <div className="places-toolbar" aria-label="Buscar e filtrar lugares">
          <input aria-label="Buscar lugares" type="search" placeholder="Buscar lugares…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Filtrar por categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todas as categorias</option>
            {PLACE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos os estados</option>
            <option value="planned">Queremos ir</option>
            <option value="visited">Já fomos</option>
          </select>
        </div>
        {places.isPending ? (
          <div className="empty-state" role="status"><MapPin /><h2>Preparando nossos próximos destinos…</h2></div>
        ) : places.isError ? (
          <div className="empty-state" role="alert"><h2>Não foi possível carregar os lugares</h2><p>Confira a conexão e tente novamente.</p><button className="button secondary" onClick={() => void places.refetch()}>Tentar novamente</button></div>
        ) : shown.length === 0 ? (
          <div className="empty-state"><MapPin size={42} strokeWidth={1} /><h2>{(places.data ?? []).length ? "Nenhum lugar encontrado" : "A lista está pronta para começar"}</h2><p>{(places.data ?? []).length ? "Ajuste a busca ou os filtros e tente novamente." : admin ? "Adicione o primeiro lugar que querem conhecer." : "Nossos lugares para ir vão aparecer aqui assim que forem adicionados."}</p></div>
        ) : (
          <div className="places-grid">
            {shown.map((place) => {
              const cover = place.photos.find((photo) => photo.is_cover) ?? place.photos[0];
              return (
                <article className="place-card" key={place.id}>
                  <button className="place-cover" aria-label={`Ver fotos de ${place.name}`} onClick={() => setDetails(place)}>
                    {cover ? <img src={placePhotoUrl(cover.object_path)} alt={`Foto de ${place.name}`} /> : <MapPin size={44} />}
                  </button>
                  <div className="place-card-body">
                    <div className="place-meta"><span className="place-pill">{place.category}</span><span className={`place-pill ${place.status === "visited" ? "status-visited" : ""}`}>{placeStatuses[place.status]}</span></div>
                    <h2>{place.name}</h2>
                    {place.location && <p className="place-location"><MapPin size={14} /> {place.location}</p>}
                    {place.description && <p className="place-description">{place.description}</p>}
                    {place.event_date && <p className="place-date"><CalendarDays size={14} /> {displayDate(place.event_date)}</p>}
                    <div className="place-card-links">
                      <button className="text-button" onClick={() => setDetails(place)}>Ver detalhes · {place.photos.length} {place.photos.length === 1 ? "foto" : "fotos"}</button>
                      {place.map_url && <a href={place.map_url} target="_blank" rel="noreferrer">Mapa <ExternalLink size={13} /></a>}
                    </div>
                    {admin && <div className="admin-actions"><button className="text-button" onClick={() => { setError(""); setEditor(place); }}><Pencil size={14} /> Editar</button><button className="icon-button danger" aria-label={`Excluir ${place.name}`} onClick={() => setConfirm(place)}><Trash2 size={16} /></button></div>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {admin && editor && <PlaceForm key={editor === "new" ? "new" : editor.id} place={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={save} />}
      {details && <PlaceDetails place={details} onClose={() => setDetails(null)} />}
      {admin && confirm && <Modal title="Excluir este lugar?" description="O lugar e todas as fotos associadas serão excluídos. Essa ação não pode ser desfeita." onClose={() => setConfirm(null)}>{error && <p role="alert" className="field-error">{error}</p>}<div className="modal-actions"><button className="button secondary" onClick={() => setConfirm(null)}>Cancelar</button><button className="button destructive" onClick={() => void remove(confirm)}>Excluir lugar</button></div></Modal>}
      {progress && <span className="sr-only" role="status">{progress}</span>}
    </main>
  );
}
