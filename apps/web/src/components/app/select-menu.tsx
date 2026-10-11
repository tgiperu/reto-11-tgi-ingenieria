import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

export function MenuShell({
  label,
  icon,
  valueLabel,
  active,
  wide,
  onOpenChange,
  children,
}: {
  label: string;
  icon: ReactNode;
  valueLabel: string;
  active: boolean;
  wide?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border bg-white py-0 pr-3 pl-3",
          active ? "border-primary bg-sel" : "border-edge",
          open && "border-primary"
        )}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex flex-none items-center justify-center text-ink-3"
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="font-semibold text-ink-3 text-xs">{label}</span>
          <span className="whitespace-nowrap font-semibold text-sm">
            {valueLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("flex-none text-ink-3", open && "rotate-180")}
          size={16}
        />
      </button>
      {open ? (
        <div
          aria-label={label}
          className={cn(
            "absolute top-[52px] left-0 z-30 flex flex-col gap-0.5 rounded-lg border border-edge bg-white p-1.5 shadow-[6px_0_0_rgb(27_27_24/18%)]",
            wide ? "w-[520px] max-w-[calc(100vw-48px)]" : "min-w-60"
          )}
          role="listbox"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export interface MenuOption<T extends string> {
  dot?: string;
  icon?: ReactNode;
  id: T;
  label: string;
}

export function OptionRow({
  on,
  onPick,
  icon,
  dot,
  children,
}: {
  on: boolean;
  onPick: () => void;
  icon?: ReactNode;
  dot?: string;
  children: ReactNode;
}) {
  return (
    <button
      aria-selected={on}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-md border-0 px-2.5 text-left text-sm",
        on ? "bg-sel font-semibold" : "bg-transparent hover:bg-sunken"
      )}
      onClick={onPick}
      role="option"
      type="button"
    >
      {dot ? (
        <span
          className="size-3 flex-none rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      {icon ? <span className="flex-none text-ink-3">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      <Check
        aria-hidden="true"
        className={cn("flex-none text-ink", !on && "invisible")}
        size={16}
      />
    </button>
  );
}

export function SelectMenu<T extends string>({
  label,
  icon,
  value,
  defaultValue,
  options,
  onChange,
  shortAll,
}: {
  label: string;
  icon: ReactNode;
  value: T;
  defaultValue: T;
  options: readonly MenuOption<T>[];
  onChange: (id: T) => void;
  shortAll: string;
}) {
  const current = options.find((o) => o.id === value);
  const active = value !== defaultValue;
  return (
    <MenuShell
      active={active}
      icon={icon}
      label={label}
      valueLabel={active ? (current?.label ?? shortAll) : shortAll}
    >
      {(close) =>
        options.map((o) => (
          <OptionRow
            dot={o.dot}
            icon={o.icon}
            key={o.id}
            on={o.id === value}
            onPick={() => {
              onChange(o.id);
              close();
            }}
          >
            {o.label}
          </OptionRow>
        ))
      }
    </MenuShell>
  );
}
