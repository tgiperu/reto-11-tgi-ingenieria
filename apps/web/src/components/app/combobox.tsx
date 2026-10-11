import { normalizeKey } from "@reto-11-tgi-ingenieria/domain/names";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface ComboItem<T extends string | number> {
  disabled?: boolean;
  hint?: string;
  id: T;
  /** Texto que queda en el campo al elegir. */
  label: string;
  name: string;
  /** Texto para buscar (por defecto, `label`). */
  search?: string;
  sub?: string;
}

interface Props<T extends string | number> {
  /** Versión baja para barras de herramientas (etiqueta solo para lectores de pantalla). */
  compact?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  headline?: (count: number, all: boolean) => string;
  hint?: string;
  items: readonly ComboItem<T>[];
  label: string;
  onEmpty?: () => void;
  onPick: (id: T) => void;
  placeholder: string;
  selected: T | null;
}

/** Campo de búsqueda con lista; pensado para dedos grandes (filas de 52 px). */
export function Combobox<T extends string | number>({
  label,
  placeholder,
  items,
  selected,
  onPick,
  hint,
  headline,
  emptyLabel = "Sin resultados · limpiar búsqueda",
  onEmpty,
  disabled,
  compact = false,
}: Props<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const q = normalizeKey(query);
  const filtered = useMemo(
    () =>
      items.filter(
        (it) => q === "" || normalizeKey(it.search ?? it.label).includes(q)
      ),
    [items, q]
  );
  const current = items.find((it) => it.id === selected);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div
      className={cn("relative flex flex-col gap-1.5", open ? "z-40" : "z-[1]")}
      ref={root}
    >
      <label
        className={cn(
          "font-semibold text-[13px] text-ink-2",
          compact && "sr-only"
        )}
        htmlFor={id}
      >
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md bg-white py-0 pr-1.5 pl-3",
          compact ? "min-h-10" : "min-h-[52px]",
          "border border-field",
          disabled && "opacity-60"
        )}
      >
        <Search aria-hidden="true" className="flex-none text-ink-3" size={18} />
        <input
          aria-controls={listId}
          aria-expanded={open}
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent font-semibold text-ink outline-none focus-visible:shadow-none",
            compact ? "text-sm" : "text-base"
          )}
          disabled={disabled}
          id={id}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={open ? query : (current?.label ?? "")}
        />
        <button
          aria-label={open ? "Cerrar lista" : "Abrir lista"}
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink-3 hover:text-ink",
            compact ? "size-8" : "size-10"
          )}
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
          type="button"
        >
          <ChevronDown
            aria-hidden="true"
            className={open ? "rotate-180" : undefined}
            size={18}
          />
        </button>
      </div>
      {hint ? <span className="text-ink-3 text-xs">{hint}</span> : null}
      {open ? (
        <div
          className={cn(
            "absolute right-0 left-0 z-30 overflow-hidden rounded-lg border border-edge bg-white shadow-[6px_0_0_rgb(27_27_24/18%)]",
            compact ? "top-[46px]" : "top-[86px]"
          )}
        >
          <div className="border-line-2 border-b px-3 py-2 text-ink-3 text-xs">
            {headline
              ? headline(filtered.length, q === "")
              : `${filtered.length} resultados`}
          </div>
          <div
            aria-label={label}
            className="max-h-[252px] overflow-y-auto py-1"
            id={listId}
            role="listbox"
          >
            {filtered.map((it) => (
              <div
                aria-selected={it.id === selected}
                key={it.id}
                role="option"
                tabIndex={-1}
              >
                <button
                  className={cn(
                    compact ? "min-h-10 text-sm" : "min-h-[52px] text-[15px]",
                    "flex w-full items-center gap-2 border-0 px-3.5 py-1.5 text-left",
                    it.disabled
                      ? "cursor-not-allowed bg-white text-ink-3"
                      : "cursor-pointer",
                    it.id === selected
                      ? "bg-ok-bg font-semibold"
                      : "bg-white hover:bg-sheet"
                  )}
                  disabled={it.disabled}
                  onClick={() => {
                    onPick(it.id);
                    close();
                  }}
                  type="button"
                >
                  <span className="flex flex-1 flex-col gap-px">
                    <span>{it.name}</span>
                    {it.sub ? (
                      <span className="font-normal text-ink-3 text-xs">
                        {it.sub}
                      </span>
                    ) : null}
                  </span>
                  {it.hint ? (
                    <span className="font-normal text-ink-3 text-xs">
                      {it.hint}
                    </span>
                  ) : null}
                </button>
              </div>
            ))}
          </div>
          {filtered.length === 0 ? (
            <button
              className="min-h-12 w-full cursor-pointer border-0 border-line-2 border-t bg-warn-bg font-semibold text-sm text-warn-fg"
              onClick={() => {
                if (onEmpty) {
                  onEmpty();
                  close();
                } else {
                  setQuery("");
                }
              }}
              type="button"
            >
              {emptyLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
