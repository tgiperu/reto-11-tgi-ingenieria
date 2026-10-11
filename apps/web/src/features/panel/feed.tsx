import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import {
  Camera,
  Check,
  CircleCheck,
  Clock,
  MapPin,
  Ruler,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/app/button";
import { Chip } from "@/components/app/chip";
import { EmptyState } from "@/components/app/panel";
import { fmtNum, fmtTimeSeconds, plural } from "@/lib/format";

export interface FeedItem {
  code: string;
  deviation: number;
  hi: number;
  id: string;
  lo: number;
  measurementId: string;
  plot: number;
  review: string;
  species: string;
  strong: boolean;
  syncedAt: string;
  value: number;
  variable: "dap" | "alt";
}

const OPEN = new Set(["pending", "justified"]);

const STATE_UI: Record<
  string,
  { label: string; tone: "warn" | "info" | "ok" | "neutral"; icon: ReactNode }
> = {
  accepted: {
    icon: <Check aria-hidden="true" size={14} />,
    label: "Aceptada",
    tone: "ok",
  },
  justified: {
    icon: <Camera aria-hidden="true" size={14} />,
    label: "Justificada con foto",
    tone: "info",
  },
  none: {
    icon: <Check aria-hidden="true" size={14} />,
    label: "Sin revisar",
    tone: "neutral",
  },
  pending: {
    icon: <TriangleAlert aria-hidden="true" size={14} />,
    label: "Por revisar",
    tone: "warn",
  },
  remeasure: {
    icon: <Ruler aria-hidden="true" size={14} />,
    label: "Re-medición pedida",
    tone: "neutral",
  },
};

const SCALE_MARGIN = 1.12;

function Gauge({ item }: { item: FeedItem }) {
  const scale = Math.max(item.value, item.hi) * SCALE_MARGIN;
  const at = (x: number) => (x / scale) * 100;
  const color = item.strong ? "var(--color-crit)" : "var(--color-warn)";
  return (
    <div aria-hidden="true" className="relative h-3.5">
      <div className="absolute inset-x-0 top-1 h-1.5 rounded-[3px] bg-sunken" />
      <div
        className="absolute top-1 h-1.5 rounded-[3px] bg-ok-band"
        style={{
          left: `${at(item.lo)}%`,
          width: `${at(item.hi) - at(item.lo)}%`,
        }}
      />
      <div
        className="absolute top-0 -ml-[7px] size-3.5 rounded-full border-2 border-white"
        style={{
          background: color,
          boxShadow: `0 0 0 1px ${color}`,
          left: `${at(item.value)}%`,
        }}
      />
    </div>
  );
}

export function Feed({
  items,
  newIds,
  counts,
  status,
  onStatus,
  count,
  onAccept,
  onRemeasure,
  busy,
}: {
  items: FeedItem[];
  newIds: ReadonlySet<string>;
  counts: { all: number; open: number; done: number };
  status: "all" | "open" | "done";
  onStatus: (s: "all" | "open" | "done") => void;
  count: number;
  onAccept: (id: string) => void;
  onRemeasure: (id: string) => void;
  busy: boolean;
}) {
  const filters = [
    { count: counts.open, id: "open", label: "Por revisar" },
    { count: counts.done, id: "done", label: "Resueltas" },
    { count: counts.all, id: "all", label: "Todas" },
  ] as const;
  return (
    <section aria-labelledby="h-feed" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-bold text-lg" id="h-feed">
            Mediciones atípicas
          </h2>
          <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
            <span className="live-dot size-2 rounded-full bg-ok" />
            {plural(count, "medición", "mediciones")} · las nuevas aparecen
            arriba
          </span>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: grupo de botones con role=group accesible */}
        <div aria-label="Estado" className="flex flex-wrap gap-2" role="group">
          {filters.map((f) => {
            const on = status === f.id;
            return (
              <button
                aria-pressed={on}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px]",
                  on
                    ? "border-primary bg-primary font-semibold text-white"
                    : "border-edge bg-white text-ink hover:bg-sunken"
                )}
                key={f.id}
                onClick={() => onStatus(f.id)}
                type="button"
              >
                {f.label}
                <span
                  className={cn(
                    "min-w-5 rounded-[3px] px-1.5 py-px text-center font-bold font-mono text-xs",
                    on ? "bg-white/25 text-white" : "bg-line-2 text-ink-2"
                  )}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-line bg-white p-0">
        {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse */}
        {items.map((item) => {
          const open = OPEN.has(item.review);
          const ui = STATE_UI[item.review] ?? STATE_UI.none;
          const isNew = newIds.has(item.id);
          const unit = item.variable === "dap" ? "cm" : "m";
          return (
            <li
              className={cn(
                "grid items-center gap-x-6 gap-y-3 border-line-2 border-t px-4 py-3.5 first:border-t-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(210px,1fr)_minmax(200px,auto)]",
                isNew && "paso bg-sel",
                !open && "text-ink-2"
              )}
              key={item.id}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-base">{item.species}</strong>
                  <Chip>{item.variable === "dap" ? "DAP" : "Altura"}</Chip>
                  {isNew ? <Chip tone="solid">NUEVA</Chip> : null}
                </div>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-ink-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <MapPin aria-hidden="true" size={14} />
                    Parcela P-{item.plot} · N° {item.code}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock aria-hidden="true" size={14} />
                    <span className="font-mono">
                      {fmtTimeSeconds(item.syncedAt)}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-[3px] px-1.5 font-bold font-mono text-xl",
                      open && "trama text-warn-fg"
                    )}
                  >
                    {fmtNum(item.value)} {unit}
                  </span>
                  <Chip tone={item.strong ? "crit" : "warn"}>
                    {item.variable === "dap"
                      ? `+${fmtNum(item.deviation)} DE`
                      : `+${fmtNum(item.deviation)} m sobre el máx.`}
                  </Chip>
                </div>
                <Gauge item={item} />
                <span className="text-ink-3 text-xs">
                  Esperado{" "}
                  <strong className="font-mono text-ink-2">
                    {fmtNum(item.lo)}–{fmtNum(item.hi)} {unit}
                  </strong>
                </span>
              </div>
              <div className="flex flex-col items-start gap-2">
                <Chip tone={ui?.tone ?? "neutral"}>
                  {ui?.icon}
                  {ui?.label}
                </Chip>
                {open ? (
                  <div className="flex gap-1.5">
                    <Button
                      disabled={busy}
                      onClick={() => onAccept(item.measurementId)}
                      size="sm"
                      variant="primary"
                    >
                      <Check aria-hidden="true" size={16} /> Aceptar
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => onRemeasure(item.measurementId)}
                      size="sm"
                    >
                      <Ruler aria-hidden="true" size={16} /> Re-medir
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
        {items.length === 0 ? (
          <li>
            <EmptyState
              icon={
                <CircleCheck aria-hidden="true" className="text-ok" size={32} />
              }
            >
              Sin mediciones atípicas con estos filtros.
            </EmptyState>
          </li>
        ) : null}
      </ul>
      <span className="max-w-[80ch] font-serif text-ink-3 text-sm">
        Rangos calculados con el histórico de mediciones (media ± k·DE para DAP;
        altura máxima por especie). Las reglas se configuran en Alertas.
      </span>
    </section>
  );
}
