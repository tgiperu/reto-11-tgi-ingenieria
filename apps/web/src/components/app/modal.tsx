import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    // biome-ignore lint/suspicious/noUnnecessaryConditions: valor mutable en tiempo de ejecución (ref o dato externo)
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={`m-auto ${{ lg: "w-[min(780px,calc(100vw-32px))]", md: "w-[min(520px,calc(100vw-32px))]", xl: "w-[min(1440px,calc(100vw-32px))]" }[size]} rounded-lg border border-line bg-white p-0 text-ink shadow-[6px_0_0_rgb(27_27_24/18%)]`}
      onClose={(e) => {
        // El evento «close» sube por el árbol de React: un diálogo anidado no debe cerrar al padre.
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      ref={ref}
    >
      {open ? (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-line border-b px-5 py-4">
            <h2 className="font-bold text-lg" id={titleId}>
              {title}
            </h2>
            <Button
              aria-label="Cerrar"
              onClick={onClose}
              size="sm"
              variant="ghost"
            >
              <X aria-hidden="true" size={18} />
            </Button>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            {children}
          </div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-line border-t px-5 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
