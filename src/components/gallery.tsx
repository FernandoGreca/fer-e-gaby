/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "./portal";
import { Modal } from "./modal";
import {
  compressImage,
  photoSchema,
  photoDate,
  sortPhotos,
  validateImage,
  type Photo,
  type PhotoInput,
} from "@/lib/gallery";
import {
  cleanObject,
  deletePhoto,
  editPhoto,
  listCleanup,
  listPhotos,
  photoUrl,
  uploadPhoto,
} from "@/lib/gallery-api";
function PhotoImage({
  photo,
  large = false,
}: {
  photo: Photo;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="photo-unavailable">
      <Camera size={32} />
      <span>Foto indisponível no momento</span>
    </div>
  ) : (
    <img
      src={photoUrl(photo.object_path)}
      alt={photo.caption || `Foto do casal em ${photoDate(photo.photo_date)}`}
      loading={large ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
function PhotoForm({
  photo,
  onClose,
  onSave,
  status,
}: {
  status: string;
  photo?: Photo;
  onClose: () => void;
  onSave: (input: PhotoInput, file?: File) => Promise<void>;
}) {
  const [caption, setCaption] = useState(photo?.caption ?? "");
  const [date, setDate] = useState(
    photo?.photo_date ?? new Date().toLocaleDateString("en-CA"),
  );
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={photo ? "Editar foto" : "Uma nova memória"}
      description="Guarde um momento especial. A data da foto é obrigatória; a legenda é opcional."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const parsed = photoSchema.safeParse({ caption, photo_date: date });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (!photo && !file) {
            setError("Escolha uma foto para enviar.");
            return;
          }
          setBusy(true);
          try {
            await onSave(parsed.data, file);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Não foi possível salvar. Confira sua sessão e conexão e tente novamente.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          {!photo && (
            <label className="field">
              Foto *
              <input
                aria-label="Foto *"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-describedby="photo-help"
                onChange={(event) => {
                  setFile(undefined);
                  setError("");
                  const next = event.target.files?.[0];
                  if (!next) return;
                  try {
                    validateImage(next);
                    setFile(next);
                  } catch (error) {
                    event.target.value = "";
                    setError((error as Error).message);
                  }
                }}
              />
              <span className="helper" id="photo-help">
                JPEG, PNG ou WebP, até 20 MB. Vamos preparar sua foto para o
                álbum.
              </span>
            </label>
          )}
          <label className="field">
            Legenda
            <textarea
              rows={3}
              maxLength={1000}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="O que torna este momento especial?"
            />
          </label>
          <label className="field">
            Data da foto *
            <input
              type="date"
              required
              min="1900-01-01"
              max="2100-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {photo && (
            <p className="helper">
              Adicionada em{" "}
              {new Date(photo.created_at).toLocaleDateString("pt-BR")}
            </p>
          )}
          {status && (
            <p role="status" className="gallery-notice">
              {status}
            </p>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="button">
              {busy ? "Salvando…" : "Salvar foto"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
export function Gallery() {
  const { admin } = useAuth();
  const client = useQueryClient();
  const photos = useQuery({ queryKey: ["gallery"], queryFn: listPhotos });
  const cleanup = useQuery({
    queryKey: ["gallery-cleanup"],
    queryFn: listCleanup,
    enabled: admin,
    refetchInterval: 60000,
  });
  const [editor, setEditor] = useState<Photo | "new" | null>(null);
  const [expanded, setExpanded] = useState<Photo | null>(null);
  const [confirm, setConfirm] = useState<Photo | null>(null);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["gallery"] }),
      client.invalidateQueries({ queryKey: ["gallery-cleanup"] }),
    ]);
  }
  const removal = useMutation({
    mutationFn: deletePhoto,
    onSuccess: async (result, _photo) => {
      client.setQueryData<Photo[]>(["gallery"], (old) =>
        (old ?? []).filter((photo) => photo.id !== _photo.id),
      );
      setConfirm(null);
      setMessage(
        result.pending
          ? "Foto retirada da galeria. A limpeza do arquivo ficou pendente e poderá ser retomada em 15 minutos."
          : "Foto excluída do álbum e do armazenamento.",
      );
      await refresh();
    },
    onError: (error) => setError(error.message),
  });
  const cleaning = useMutation({
    mutationFn: async () => {
      for (const row of cleanup.data ?? []) await cleanObject(row.object_path);
    },
    onSuccess: async () => {
      setMessage("Limpeza concluída.");
      await refresh();
    },
    onError: () =>
      setError(
        "A limpeza ainda não foi concluída. Os arquivos continuam registrados para uma nova tentativa.",
      ),
  });
  const shown = sortPhotos(photos.data ?? []);
  return (
    <main id="conteudo">
      <section className="hero">
        <span className="eyebrow">
          <span />
          NOSSO ÁLBUM DE AFETOS
          <span />
        </span>
        <h1>
          Instantes que ficam.
          <br />
          <em>Memórias que abraçam.</em>
        </h1>
        <p>
          Um lugar para guardar os nossos dias e dividir um pouquinho da nossa
          história com você.
        </p>
        <div className="hero-heart">
          <Heart size={17} />
          <span>cada foto, um pedacinho de nós</span>
        </div>
      </section>
      <section className="gallery-section" aria-label="Galeria de fotos">
        <div className="list-heading">
          <div>
            <span className="eyebrow">VIVIDOS COM AMOR</span>
            <h2>
              Nossas memórias <span className="count">{shown.length}</span>
            </h2>
          </div>
          {admin && (
            <button
              className="button"
              onClick={() => {
                setError("");
                setEditor("new");
              }}
            >
              <Plus size={17} />
              Adicionar foto
            </button>
          )}
        </div>
        {message && (
          <p className="gallery-notice" role="status">
            {message}
          </p>
        )}
        {error && !confirm && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {admin && cleanup.isError && (
          <p role="alert" className="error-banner">
            Não foi possível consultar a limpeza pendente.{" "}
            <button
              className="text-button"
              onClick={() => void cleanup.refetch()}
            >
              Tentar novamente
            </button>
          </p>
        )}
        {admin && !!cleanup.data?.length && (
          <div className="form-callout">
            <p>Há arquivos de operações interrompidas aguardando limpeza.</p>
            <button
              className="button secondary"
              disabled={cleaning.isPending}
              onClick={() => {
                setError("");
                cleaning.mutate();
              }}
            >
              {cleaning.isPending ? "Limpando…" : "Retomar limpeza"}
            </button>
          </div>
        )}
        {photos.isPending ? (
          <div className="empty-state" role="status">
            <Camera />
            <h2>Preparando nossas memórias…</h2>
          </div>
        ) : photos.isError ? (
          <div className="empty-state" role="alert">
            <h2>Não foi possível abrir o álbum</h2>
            <p>Confira a conexão e tente novamente.</p>
            <button
              className="button secondary"
              onClick={() => void photos.refetch()}
            >
              Tentar novamente
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <Camera size={42} strokeWidth={1} />
            <h2>Uma história pronta para ganhar fotos</h2>
            <p>
              {admin
                ? "Adicione a primeira memória do nosso álbum."
                : "Nossas fotos vão aparecer aqui assim que forem adicionadas."}
            </p>
          </div>
        ) : (
          <div className="gallery-grid">
            {shown.map((photo) => (
              <article className="photo-card" key={photo.id}>
                <button
                  className="photo-open"
                  aria-label={`Ampliar ${photo.caption || "foto de " + photoDate(photo.photo_date)}`}
                  onClick={() => setExpanded(photo)}
                >
                  <PhotoImage photo={photo} />
                </button>
                <div className="photo-caption">
                  {photo.caption && <p>{photo.caption}</p>}
                  <time dateTime={photo.photo_date}>
                    {photoDate(photo.photo_date)}
                  </time>
                  {admin && (
                    <div className="admin-actions">
                      <button
                        className="text-button"
                        onClick={() => {
                          setError("");
                          setEditor(photo);
                        }}
                      >
                        <Pencil size={14} />
                        Editar foto
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`Excluir ${photo.caption || "foto"}`}
                        onClick={() => {
                          setError("");
                          setConfirm(photo);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {expanded && (
        <Modal
          title={expanded.caption || "Uma memória nossa"}
          description={photoDate(expanded.photo_date)}
          className="lightbox"
          onClose={() => setExpanded(null)}
        >
          <div className="lightbox-image">
            <PhotoImage photo={expanded} large />
          </div>
        </Modal>
      )}
      {admin && editor && (
        <PhotoForm
          status={status}
          photo={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={async (input, file) => {
            try {
              setStatus(
                editor === "new" ? "Preparando imagem…" : "Salvando detalhes…",
              );
              const record =
                editor === "new"
                  ? await uploadPhoto(
                      await compressImage(file!),
                      input,
                      setStatus,
                    )
                  : await editPhoto(editor.id, input);
              client.setQueryData<Photo[]>(["gallery"], (old) => [
                ...(old ?? []).filter((photo) => photo.id !== record.id),
                record,
              ]);
              setEditor(null);
              setMessage("Memória salva com carinho.");
              await refresh();
            } finally {
              setStatus("");
              void refresh();
            }
          }}
        />
      )}
      {admin && confirm && (
        <Modal
          title="Excluir esta foto?"
          description="A foto e seu arquivo serão excluídos. Essa ação não pode ser desfeita."
          onClose={() => {
            if (!removal.isPending) setConfirm(null);
          }}
        >
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={removal.isPending}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              className="button destructive"
              disabled={removal.isPending}
              onClick={() => {
                setError("");
                removal.mutate(confirm);
              }}
            >
              {removal.isPending ? "Excluindo…" : "Excluir foto"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
