import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral" | "solid";

const TONES: Record<Tone, string> = {
  crit: "bg-crit-bg text-crit-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-line-2 text-ink-2",
  ok: "bg-ok-bg text-ok-fg",
  solid: "bg-primary text-white",
  warn: "bg-warn-bg text-warn-fg",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2.5 py-0.5 font-semibold text-xs",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

import type { PlotStatus } from "@reto-11-tgi-ingenieria/domain/constants";
import { PLOT_STATUS_LABELS } from "@reto-11-tgi-ingenieria/domain/constants";

const PLOT_TONES: Record<PlotStatus, Tone> = {
  alert: "warn",
  assigned: "neutral",
  locked: "ok",
  review: "info",
  unlocked: "crit",
};

export function PlotStatusChip({ status }: { status: string }) {
  const key = status as PlotStatus;
  return (
    <Chip tone={PLOT_TONES[key] ?? "neutral"}>
      {PLOT_STATUS_LABELS[key] ?? status}
    </Chip>
  );
}
