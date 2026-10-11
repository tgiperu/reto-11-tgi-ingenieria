import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className="flex flex-wrap gap-1 border-line border-b"
      role="tablist"
    >
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            aria-selected={on}
            className={cn(
              "-mb-px min-h-11 cursor-pointer border-b-[3px] bg-transparent px-4 text-sm",
              on
                ? "border-primary font-bold text-ink"
                : "border-transparent text-ink-3 hover:text-ink"
            )}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: grupo de botones con role=group accesible
    <div aria-label={label} className="flex flex-wrap gap-2" role="group">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            aria-pressed={on}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px]",
              on
                ? "border-primary bg-sel font-semibold text-ink"
                : "border-edge bg-white text-ink hover:bg-sunken"
            )}
            key={o.id}
            onClick={() => onChange(o.id)}
            type="button"
          >
            {o.label}
            {o.count === undefined ? null : <span>· {o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
