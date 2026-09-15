"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Modal({
  title,
  description,
  children,
  onClose,
  className = "",
}: {
  className?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const [returnFocus] = useState(() =>
    typeof document !== "undefined" ? document.activeElement : null,
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${className}`}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus instanceof HTMLElement && returnFocus.isConnected)
              returnFocus.focus();
          }}
        >
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <Dialog.Close className="icon-button close" aria-label="Fechar">
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
