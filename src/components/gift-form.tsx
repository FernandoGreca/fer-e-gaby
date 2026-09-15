"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import {
  giftSchema,
  httpUrl,
  priorities,
  type Gift,
  type GiftInput,
  type Wishlist,
} from "@/lib/gifts";
import { supabase } from "@/lib/supabase";
import { Modal } from "./modal";

export function GiftForm({
  gift,
  listId,
  lists,
  onSave,
  onClose,
  pending,
}: {
  gift?: Gift;
  listId: string;
  lists: Wishlist[];
  onSave: (v: GiftInput) => Promise<void>;
  onClose: () => void;
  pending: boolean;
}) {
  const [extracting, setExtracting] = useState(false),
    [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const [receiptInput, setReceiptInput] = useState<GiftInput | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<GiftInput>({
    resolver: zodResolver(giftSchema),
    defaultValues: {
      wishlist_id: gift?.wishlist_id ?? listId,
      product_url: gift?.product_url ?? "",
      name: gift?.name ?? "",
      image_url: gift?.image_url ?? "",
      price: gift?.price?.toString() ?? "",
      currency: gift?.currency ?? "BRL",
      priority: gift?.priority ?? "medium",
      description: gift?.description ?? "",
      notes: gift?.notes ?? "",
      tags: gift?.tags.join(", ") ?? "",
      status: gift?.status ?? "wanted",
    },
  });
  async function extract(url: string) {
    if (!httpUrl(url)) {
      setNotice(
        "Cole um link HTTP ou HTTPS válido. Você também pode preencher tudo manualmente.",
      );
      return;
    }
    const id = ++requestId.current;
    const before = getValues();
    setExtracting(true);
    setNotice("Buscando informações na loja…");
    try {
      const { data, error } = await supabase.functions.invoke(
        "extract-product",
        { body: { url } },
      );
      if (id !== requestId.current || getValues("product_url") !== url) return;
      if (error) throw error;
      for (const [field, key] of [
        ["name", "name"],
        ["image_url", "imageUrl"],
        ["price", "price"],
        ["currency", "currency"],
      ] as const) {
        if (
          data?.[key] != null &&
          getValues(field) === before[field] &&
          (!before[field] || (field === "currency" && !dirtyFields.currency))
        )
          setValue(field, String(data[key]), {
            shouldValidate: true,
            shouldDirty: true,
          });
      }
      setNotice(
        data.warnings?.length
          ? `Preenchimento parcial. ${data.warnings.join(" ")} Revise os campos abaixo.`
          : "Informações encontradas. Confira os dados antes de salvar.",
      );
    } catch {
      if (id === requestId.current)
        setNotice(
          "Esta loja não permitiu a leitura. Preencha os campos manualmente; você pode salvar normalmente.",
        );
    } finally {
      if (id === requestId.current) setExtracting(false);
    }
  }
  const field = (
    key: keyof GiftInput,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="field">
      {label}
      <input
        {...register(key)}
        {...props}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `error-${key}` : undefined}
      />
      {errors[key] && (
        <span id={`error-${key}`} className="field-error">
          {errors[key]?.message}
        </span>
      )}
    </label>
  );
  return (
    <Modal
      title={gift ? "Editar presente" : "Um novo desejo"}
      description="Um detalhe especial para a nossa lista. Campos com * são obrigatórios."
      onClose={() => {
        if (!pending) {
          requestId.current++;
          onClose();
        }
      }}
    >
      <form
        noValidate
        onSubmit={handleSubmit(async (input) => {
          if (input.status === "received" && gift?.status !== "received")
            setReceiptInput(input);
          else await onSave(input);
        })}
      >
        <fieldset disabled={pending}>
          <div className="import-box">
            <label className="field">
              Link do produto *
              <input
                {...register("product_url")}
                type="url"
                placeholder="https://loja.com/produto"
                onPaste={(event) => {
                  const value = event.clipboardData.getData("text").trim();
                  if (httpUrl(value)) {
                    event.preventDefault();
                    setValue("product_url", value, { shouldDirty: true });
                    void extract(value);
                  }
                }}
                aria-invalid={!!errors.product_url}
              />
              {errors.product_url && (
                <span className="field-error">
                  {errors.product_url.message}
                </span>
              )}
            </label>
            <button
              className="button secondary"
              type="button"
              disabled={extracting}
              onClick={() => void extract(getValues("product_url"))}
            >
              <Sparkles size={16} />
              {extracting ? "Buscando…" : "Preencher pelo link"}
            </button>
            <p className="helper" role="status">
              {notice ||
                "Ao colar um link, tentamos encontrar nome, imagem e preço."}
            </p>
          </div>
          {field("name", "Nome do presente *", { maxLength: 200 })}
          <div className="form-grid">
            <label className="field">
              Lista *
              <select {...register("wishlist_id")}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Prioridade
              <select {...register("priority")}>
                {Object.entries(priorities).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {field("price", "Preço", {
              inputMode: "decimal",
              placeholder: "0,00",
            })}
            {field("currency", "Moeda", { maxLength: 3 })}
          </div>
          {field("image_url", "URL da imagem", {
            type: "url",
            placeholder: "https://…",
          })}
          <label className="field">
            Descrição
            <textarea {...register("description")} rows={3} maxLength={4000} />
            {errors.description && (
              <span className="field-error">{errors.description.message}</span>
            )}
          </label>
          <label className="field">
            Observações
            <textarea
              {...register("notes")}
              rows={2}
              maxLength={2000}
              placeholder="Tamanho, cor, modelo ou um detalhe importante"
            />
            {errors.notes && (
              <span className="field-error">{errors.notes.message}</span>
            )}
          </label>
          {field("tags", "Etiquetas", {
            placeholder: "casa, livros, tecnologia",
          })}
          <p className="helper">Separe as etiquetas por vírgulas.</p>
          <label className="field">
            Status
            <select {...register("status")}>
              <option value="wanted">Desejado</option>
              <option value="received">Ganho</option>
            </select>
          </label>
          {gift && (
            <p className="helper">
              Criado em {new Date(gift.created_at).toLocaleDateString("pt-BR")}{" "}
              · Atualizado em{" "}
              {new Date(gift.updated_at).toLocaleDateString("pt-BR")}
              {gift.received_at &&
                ` · Recebido em ${new Date(gift.received_at).toLocaleDateString("pt-BR")}`}
            </p>
          )}
          {receiptInput && (
            <div className="import-box" role="alert">
              <p>
                Confirmar que este presente já foi ganho? Ele será guardado no
                histórico.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setReceiptInput(null)}
                >
                  Voltar ao formulário
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void onSave(receiptInput);
                    setReceiptInput(null);
                  }}
                >
                  Confirmar recebimento
                </button>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="button" type="submit">
              {pending ? "Salvando…" : "Salvar presente"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
