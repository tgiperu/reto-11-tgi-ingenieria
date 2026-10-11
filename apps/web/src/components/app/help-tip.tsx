import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { CircleHelp } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

/** Estado de una ayuda: el botón la abre y la nota aparece justo debajo de la etiqueta. */
export function useHelp() {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  return { noteId, open, toggle: () => setOpen((v) => !v) };
}

export function HelpButton({
  label,
  noteId,
  open,
  onToggle,
}: {
  label: string;
  noteId: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-controls={noteId}
      aria-expanded={open}
      aria-label={`Ayuda: ${label}`}
      className={cn(
        "-my-2.5 flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent hover:text-ink",
        open ? "text-primary" : "text-ink-3"
      )}
      onClick={onToggle}
      type="button"
    >
      <CircleHelp aria-hidden="true" size={16} />
    </button>
  );
}

export function HelpNote({
  id,
  open,
  children,
}: {
  id: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <p
      className="m-0 rounded-md bg-sunken px-2.5 py-2 text-ink-2 text-xs leading-snug"
      hidden={!open}
      id={id}
    >
      {children}
    </p>
  );
}

/** Etiqueta con icono de ayuda; la descripción se despliega al tocarlo. */
export function HelpLabel({
  children,
  className,
  help,
  htmlFor,
  label,
}: {
  children: ReactNode;
  className?: string;
  help?: string;
  htmlFor?: string;
  /** Nombre del campo para el lector de pantalla. */
  label: string;
}) {
  const { noteId, open, toggle } = useHelp();
  const Text = htmlFor ? "label" : "span";
  if (!help) {
    return (
      <Text className={className} htmlFor={htmlFor}>
        {children}
      </Text>
    );
  }
  return (
    <>
      <div className="flex items-center gap-0.5">
        <Text className={className} htmlFor={htmlFor}>
          {children}
        </Text>
        <HelpButton
          label={label}
          noteId={noteId}
          onToggle={toggle}
          open={open}
        />
      </div>
      <HelpNote id={noteId} open={open}>
        {help}
      </HelpNote>
    </>
  );
}
