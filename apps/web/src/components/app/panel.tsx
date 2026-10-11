import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-line bg-white",
        className
      )}
      {...rest}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-balance font-bold text-[26px] leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <span className="max-w-[68ch] font-serif text-[15px] text-ink-3 leading-relaxed">
            {subtitle}
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "ok" | "warn" | "crit" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    crit: "border-crit/30 bg-crit-bg text-crit-fg",
    info: "border-info/30 bg-info-bg text-info-fg",
    ok: "border-ok-band bg-ok-bg text-ok-fg",
    warn: "border-warn-edge bg-warn-bg text-warn-fg",
  } as const;
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-[13px]",
        tones[tone],
        className
      )}
      role="status"
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-sunken px-3 py-8 text-center text-ink-2 text-sm">
      {icon}
      {children}
    </div>
  );
}

export function Table({
  children,
  minWidth = 720,
  maxHeight = "min(60vh, 520px)",
  fixed = false,
}: {
  children: ReactNode;
  minWidth?: number;
  maxHeight?: string;
  /** Anchos de columna fijos (usar con <colgroup>). */
  fixed?: boolean;
}) {
  return (
    <div className="table-scroll overflow-auto" style={{ maxHeight }}>
      <table
        className={cn(
          "w-full border-collapse text-[13px]",
          fixed && "table-fixed"
        )}
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 whitespace-nowrap bg-sunken px-2 py-2.5 text-left font-semibold text-ink-3 text-xs uppercase tracking-wider first:pl-4 last:pr-4",
        className
      )}
      {...rest}
    />
  );
}

export function Td({
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-line-2 border-t px-2 py-2.5 first:pl-4 last:pr-4",
        className
      )}
      {...rest}
    />
  );
}
