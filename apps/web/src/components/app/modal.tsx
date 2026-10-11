import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="modal-title"
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-lg border border-line bg-white p-0 text-ink shadow-[6px_0_0_rgb(27_27_24/18%)]"
      onClose={onClose}
      ref={ref}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-line border-b px-5 py-4">
            <h2 className="font-bold text-lg" id="modal-title">
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
