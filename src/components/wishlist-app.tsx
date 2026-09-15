/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  Gift as GiftIcon,
  Heart,
  History,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./portal";
import {
  emptyFilters,
  giftPayload,
  money,
  priorities,
  selectGifts,
  type Gift,
  type GiftInput,
  type Wishlist,
} from "@/lib/gifts";
import { Modal } from "./modal";
import { GiftForm } from "./gift-form";

function GiftImage({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="gift-image">
      {url && !failed ? (
        /* Remote store images load without server optimization. */ <img
          src={url}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="image-placeholder">
          <GiftIcon size={42} strokeWidth={1} />
          <span>Um desejo especial</span>
        </div>
      )}
    </div>
  );
}
export function WishlistApp() {
  const queryClient = useQueryClient();
  const { admin } = useAuth();
  const [slug, setSlug] = useState("fer"),
    [history, setHistory] = useState(false),
    [filters, setFilters] = useState(emptyFilters),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [editor, setEditor] = useState<Gift | "new" | null>(null),
    [confirm, setConfirm] = useState<{
      gift: Gift;
      action: "delete" | "received";
    } | null>(null),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState("");
  const lists = useQuery({
    queryKey: ["wishlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("*")
        .order("position");
      if (error) throw error;
      return data as Wishlist[];
    },
  });
  const gifts = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => {
      const all: Gift[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("gifts")
          .select("*")
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data as Gift[]));
        if (data.length < 1000) break;
      }
      return all;
    },
  });
  const list = lists.data?.find((l) => l.slug === slug),
    all = gifts.data ?? [];
  const shown = selectGifts(all, list?.id ?? "", history, filters);
  const tags = [
    ...new Set(
      all
        .filter(
          (g) =>
            g.wishlist_id === list?.id &&
            g.status === (history ? "received" : "wanted"),
        )
        .flatMap((g) => g.tags),
    ),
  ].sort();
  const total = all.filter(
    (g) =>
      g.wishlist_id === list?.id &&
      g.status === (history ? "received" : "wanted"),
  ).length;
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { type: "save"; input: GiftInput; id?: string }
        | { type: "delete" | "received"; id: string },
    ) => {
      setFailure("");
      let result;
      if (action.type === "save") {
        const payload = giftPayload(action.input);
        result = action.id
          ? await supabase
              .from("gifts")
              .update(payload)
              .eq("id", action.id)
              .select()
              .single()
          : await supabase.from("gifts").insert(payload).select().single();
      } else if (action.type === "delete")
        result = await supabase
          .from("gifts")
          .delete()
          .eq("id", action.id)
          .select()
          .single();
      else
        result = await supabase
          .from("gifts")
          .update({ status: "received" })
          .eq("id", action.id)
          .select()
          .single();
      if (result.error) throw result.error;
      return { type: action.type, record: result.data as Gift };
    },
    onSuccess: async ({ type, record }) => {
      queryClient.setQueryData<Gift[]>(["gifts"], (current) => {
        const remaining = (current ?? []).filter((g) => g.id !== record.id);
        return type === "delete" ? remaining : [...remaining, record];
      });
      setEditor(null);
      setConfirm(null);
      setMessage(
        type === "delete"
          ? "Presente excluído."
          : type === "received"
            ? "Presente guardado no histórico. Obrigado pelo carinho!"
            : "Presente salvo com carinho.",
      );
      await queryClient.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: () =>
      setFailure(
        "Não foi possível salvar a alteração. Verifique sua conexão e se a sessão ainda está ativa; tente novamente.",
      ),
  });
  function changeList(value: string) {
    setSlug(value);
    setFilters(emptyFilters);
  }
  const activeFilters = Object.values(filters).some(Boolean);
  return (
    <>
      <main id="conteudo">
        <section className="hero">
          <span className="eyebrow">
            <span /> NOSSO CANTINHO DE DESEJOS <span />
          </span>
          <h1>
            {history ? (
              <>
                Carinhos que viraram <em>memórias.</em>
              </>
            ) : (
              <>
                Pequenos desejos,
                <br />
                grandes <em>sorrisos.</em>
              </>
            )}
          </h1>
          <p>
            {history
              ? "Cada presente recebido tem um lugar especial na nossa história."
              : "Uma coleção das coisas que a gente ama. Escolha uma lista e descubra o que faz nossos olhos brilharem."}
          </p>
          <div className="hero-heart" aria-hidden="true">
            <Heart size={17} />
            <span>feito de amor e boas ideias</span>
          </div>
          <span className="decor decor-left" aria-hidden="true">
            ✳
          </span>
          <span className="decor decor-right" aria-hidden="true">
            ✧
          </span>
        </section>
        <section
          className="lists-section"
          id="listas"
          aria-label="Listas de presentes"
        >
          <div className="tabs" role="tablist" aria-label="De quem é a lista?">
            {[
              ["fer", "Lista presentes Fer"],
              ["gaby", "Lista presentes Gaby"],
            ].map(([value, label]) => (
              <button
                key={value}
                id={`tab-${value}`}
                role="tab"
                aria-selected={slug === value}
                aria-controls="gift-panel"
                tabIndex={slug === value ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? "fer"
                        : event.key === "End"
                          ? "gaby"
                          : slug === "fer"
                            ? "gaby"
                            : "fer";
                    changeList(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
                onClick={() => changeList(value)}
              >
                <span className="avatar">{value === "fer" ? "F" : "G"}</span>
                {label}
                <Heart className="tab-heart" size={16} />
              </button>
            ))}
          </div>
          <div className="list-heading">
            <div>
              <span className="eyebrow">
                {history ? "NOSSO HISTÓRICO" : "ESCOLHIDOS COM CARINHO"}
              </span>
              <h2>
                {history
                  ? "Presentes que já chegaram"
                  : `Os desejos de ${slug === "fer" ? "Fer" : "Gaby"}`}{" "}
                <span className="count">{total}</span>
              </h2>
            </div>
            <div className="list-actions">
              <button
                className="button secondary"
                onClick={() => {
                  setHistory(!history);
                  setFilters(emptyFilters);
                }}
              >
                <History size={17} />
                {history ? "Ver desejos" : "Já ganhamos"}
              </button>
              <button
                className="button secondary filter-toggle"
                aria-expanded={filtersOpen}
                aria-controls="filters"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={17} />
                Filtros{activeFilters ? " •" : ""}
              </button>
              {admin && (
                <button
                  className="button"
                  onClick={() => {
                    setFailure("");
                    setEditor("new");
                  }}
                  disabled={!list}
                >
                  <Plus size={17} />
                  Novo presente
                </button>
              )}
            </div>
          </div>
          <div
            id="filters"
            className={`filters ${filtersOpen ? "is-open" : ""}`}
          >
            <div className="filter-caption">
              <SlidersHorizontal size={17} />
              <span>Encontre um desejo</span>
            </div>
            {!history && (
              <label>
                Prioridade
                <select
                  value={filters.priority}
                  onChange={(e) =>
                    setFilters({ ...filters, priority: e.target.value })
                  }
                >
                  <option value="">Todas as prioridades</option>
                  {Object.entries(priorities).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Preço mínimo
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="R$ 0"
                value={filters.min}
                onChange={(e) =>
                  setFilters({ ...filters, min: e.target.value })
                }
              />
            </label>
            <label>
              Preço máximo
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Sem limite"
                value={filters.max}
                onChange={(e) =>
                  setFilters({ ...filters, max: e.target.value })
                }
              />
            </label>
            <label>
              Etiqueta
              <select
                value={filters.tag}
                onChange={(e) =>
                  setFilters({ ...filters, tag: e.target.value })
                }
              >
                <option value="">Todas as etiquetas</option>
                {tags.map((tag) => (
                  <option key={tag}>{tag}</option>
                ))}
              </select>
            </label>
            {activeFilters && (
              <button
                className="text-button"
                onClick={() => setFilters(emptyFilters)}
              >
                <X size={15} />
                Limpar
              </button>
            )}
          </div>
          {filters.min &&
            filters.max &&
            Number(filters.min) > Number(filters.max) && (
              <p role="alert" className="error-banner">
                O preço mínimo deve ser menor ou igual ao máximo.
              </p>
            )}
          <div role="status" className={message ? "toast" : ""}>
            {message && (
              <>
                <Check size={17} />
                {message}
                <button
                  className="icon-button"
                  aria-label="Dispensar mensagem"
                  onClick={() => setMessage("")}
                >
                  <X size={15} />
                </button>
              </>
            )}
          </div>
          {failure && (
            <p role="alert" className="error-banner">
              {failure}
            </p>
          )}
          <div
            id="gift-panel"
            role="tabpanel"
            aria-labelledby={`tab-${slug}`}
            tabIndex={0}
          >
            {lists.isPending || gifts.isPending ? (
              <div className="empty-state" role="status">
                <Heart className="pulse" />
                <h3>Preparando nossos desejos…</h3>
              </div>
            ) : lists.isError || gifts.isError ? (
              <div className="empty-state" role="alert">
                <h3>Nosso cantinho está indisponível</h3>
                <p>
                  Não conseguimos carregar as listas. Tente novamente em
                  instantes.
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    void lists.refetch();
                    void gifts.refetch();
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : !shown.length ? (
              <div className="empty-state">
                <div className="empty-icon">
                  {history ? (
                    <Heart size={35} strokeWidth={1.2} />
                  ) : (
                    <GiftIcon size={35} strokeWidth={1.2} />
                  )}
                </div>
                <h3>
                  {activeFilters
                    ? "Nenhum desejo com esses filtros"
                    : history
                      ? "As boas memórias vêm por aí"
                      : "Espaço para os próximos sorrisos"}
                </h3>
                <p>
                  {activeFilters
                    ? "Experimente outra combinação ou limpe os filtros."
                    : history
                      ? "Os presentes recebidos vão aparecer aqui, guardados com carinho."
                      : "A lista ainda está sendo preparada. Logo teremos desejos especiais por aqui."}
                </p>
                {activeFilters ? (
                  <button
                    className="button secondary"
                    onClick={() => setFilters(emptyFilters)}
                  >
                    Limpar filtros
                  </button>
                ) : admin && !history ? (
                  <button
                    className="button secondary"
                    onClick={() => setEditor("new")}
                  >
                    <Plus size={16} />
                    Adicionar o primeiro desejo
                  </button>
                ) : (
                  <span className="empty-signature">com amor, Fer + Gaby</span>
                )}
              </div>
            ) : (
              <>
                <div className="results-line">
                  <span>
                    {shown.length}{" "}
                    {shown.length === 1 ? "presente" : "presentes"}
                    {activeFilters ? ` de ${total}` : ""}
                  </span>
                  <span>
                    {history
                      ? "Recebidos mais recentemente"
                      : "Mais desejados primeiro"}{" "}
                    <Sparkles size={13} />
                  </span>
                </div>
                <div className="gift-grid">
                  {shown.map((g) => (
                    <article className="gift-card" key={g.id}>
                      <div className="image-wrap">
                        <GiftImage
                          key={g.image_url}
                          url={g.image_url}
                          name={g.name}
                        />
                        <span className={`priority ${g.priority}`}>
                          <span />
                          {priorities[g.priority]} prioridade
                        </span>
                      </div>
                      <div className="card-body">
                        <h3>{g.name}</h3>
                        <p className="price">{money(g.price, g.currency)}</p>
                        {g.description && (
                          <p className="description">{g.description}</p>
                        )}
                        {g.notes && (
                          <p className="notes">
                            <span>Um detalhe</span>
                            {g.notes}
                          </p>
                        )}
                        {g.tags.length > 0 && (
                          <div className="tags">
                            {g.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        )}
                        {history && g.received_at && (
                          <p className="received-date">
                            <Heart size={13} />
                            Recebido em{" "}
                            {new Date(g.received_at).toLocaleDateString(
                              "pt-BR",
                            )}
                          </p>
                        )}
                        <a
                          className="store-link"
                          href={g.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver na loja
                          <ArrowUpRight size={18} />
                        </a>
                        {admin && (
                          <div className="admin-actions">
                            <button
                              className="text-button"
                              onClick={() => {
                                setFailure("");
                                setEditor(g);
                              }}
                            >
                              <Pencil size={14} />
                              Editar
                            </button>
                            {!history && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setFailure("");
                                  setConfirm({ gift: g, action: "received" });
                                }}
                              >
                                <Check size={15} />
                                Ganhei
                              </button>
                            )}
                            <button
                              className="icon-button danger"
                              aria-label={`Excluir ${g.name}`}
                              onClick={() => {
                                setFailure("");
                                setConfirm({ gift: g, action: "delete" });
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
        <aside className="love-note">
          <Heart size={20} strokeWidth={1.3} />
          <p>
            O melhor presente é ter você por perto.
            <span>O resto são pequenas formas de espalhar carinho.</span>
          </p>
        </aside>
      </main>
      {editor && admin && list && (
        <GiftForm
          gift={editor === "new" ? undefined : editor}
          listId={list.id}
          lists={lists.data ?? []}
          pending={mutation.isPending}
          onClose={() => setEditor(null)}
          onSave={async (input) => {
            try {
              await mutation.mutateAsync({
                type: "save",
                input,
                id: editor === "new" ? undefined : editor.id,
              });
            } catch {
              /* Mutation renders the error below. */
            }
          }}
        />
      )}
      {editor && failure && (
        <div className="modal-error" role="alert">
          {failure}
        </div>
      )}
      {confirm && admin && (
        <Modal
          title={
            confirm.action === "delete"
              ? "Excluir este presente?"
              : "Esse desejo virou presente?"
          }
          description={
            confirm.action === "delete"
              ? `“${confirm.gift.name}” será excluído. Essa ação não pode ser desfeita.`
              : `“${confirm.gift.name}” vai sair dos desejos e aparecer no histórico. Você pode mudar o status depois.`
          }
          onClose={() => {
            if (!mutation.isPending) setConfirm(null);
          }}
        >
          {failure && (
            <p role="alert" className="field-error">
              {failure}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              className={`button ${confirm.action === "delete" ? "destructive" : ""}`}
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({ type: confirm.action, id: confirm.gift.id })
              }
            >
              {mutation.isPending
                ? "Salvando…"
                : confirm.action === "delete"
                  ? "Excluir presente"
                  : "Sim, ganhei!"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
