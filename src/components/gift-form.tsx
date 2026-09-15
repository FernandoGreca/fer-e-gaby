"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  giftSchema,
  priorities,
  type Gift,
  type GiftInput,
  type Wishlist,
} from "@/lib/gifts";
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
  const [receiptInput, setReceiptInput] = useState<GiftInput | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
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
          {field("product_url", "Link do produto *", {
            type: "url",
            placeholder: "https://loja.com/produto",
          })}
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
            <div className="form-callout" role="alert">
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
