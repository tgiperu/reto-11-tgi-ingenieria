import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Panel } from "@/components/app/panel";
import { fmtInt, fmtNum } from "@/lib/format";

export interface SpeciesRow {
  altDots: number[];
  altOut: number;
  dapDots: number[];
  dapMax: number | null;
  dapMean: number | null;
  dapMin: number | null;
  dapOut: number;
  heightMax: number | null;
  heightMean: number | null;
  id: number;
  n: number;
  name: string;
}

const MIN_DAP_SCALE = 60;
const MIN_HEIGHT_SCALE = 25;
const SCALE_STEP = 10;
const SCALE_MARGIN = 1.1;
const MAX_PCT = 98.5;
const LOW_HEIGHT = 1.5;

function niceScale(values: number[], min: number): number {
  const top = Math.max(min, ...values) * SCALE_MARGIN;
  return Math.max(min, Math.ceil(top / SCALE_STEP) * SCALE_STEP);
}

function pct(value: number, scale: number): number {
  return Math.min(MAX_PCT, (value / scale) * 100);
}

function Bar({
  lo,
  hi,
  mean,
  dots,
  scale,
  unit,
  out,
  outLabel,
  showDots,
}: {
  lo: number;
  hi: number | null;
  mean: number | null;
  dots: number[];
  scale: number;
  unit: string;
  out: number;
  outLabel: string;
  showDots: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-2 text-xs">
          Normal{" "}
          <strong className="font-mono">
            {hi === null ? "sin rango" : `${fmtNum(lo)}–${fmtNum(hi)} ${unit}`}
          </strong>
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] bg-warn-bg px-2.5 py-1 font-semibold text-warn-fg text-xs">
          <TriangleAlert aria-hidden="true" size={13} />
          {out} {outLabel}
        </span>
      </div>
      <div aria-hidden="true" className="relative h-[18px]">
        <div className="absolute inset-x-0 top-1.5 h-1.5 rounded-[3px] bg-sunken" />
        {hi === null ? null : (
          <div
            className="absolute top-1.5 h-1.5 rounded-[3px] bg-ok-band"
            style={{
              left: `${pct(lo, scale)}%`,
              width: `${Math.max(1, pct(hi, scale) - pct(lo, scale))}%`,
            }}
          />
        )}
        {mean === null ? null : (
          <div
            className="absolute top-0.5 h-3.5 w-[3px] bg-primary"
            style={{ left: `${pct(mean, scale)}%` }}
          />
        )}
        {showDots
          ? dots.map((d, i) => (
              <div
                className="absolute top-px -ml-2 size-4 rounded-full border-2 border-white bg-warn shadow-[0_0_0_1px_var(--color-warn)]"
                // biome-ignore lint/suspicious/noArrayIndexKey: los puntos no tienen identidad propia
                key={`${d}-${i}`}
                style={{ left: `${pct(d, scale)}%` }}
              />
            ))
          : null}
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between font-mono text-ink-3 text-xs"
      >
        <span>0</span>
        <span>media {fmtNum(mean)}</span>
        <span>
          {scale} {unit}
        </span>
      </div>
    </div>
  );
}

function Legend(): ReactNode {
  return (
    <div className="flex flex-wrap gap-2 text-ink-2 text-xs">
      <span className="flex items-center gap-1.5 rounded-[4px] bg-paper px-2.5 py-1.5">
        <span className="h-2 w-[18px] rounded-[2px] bg-ok-band" />
        Rango normal
      </span>
      <span className="flex items-center gap-1.5 rounded-[4px] bg-paper px-2.5 py-1.5">
        <span className="h-3 w-[3px] bg-primary" />
        Media
      </span>
      <span className="flex items-center gap-1.5 rounded-[4px] bg-warn-bg px-2.5 py-1.5 text-warn-fg">
        <span className="size-3 rounded-full border-2 border-white bg-warn shadow-[0_0_0_1px_var(--color-warn)]" />
        Atípica
      </span>
    </div>
  );
}

export function SpeciesRanges({
  rows,
  selected,
  onSelect,
  variable,
}: {
  rows: SpeciesRow[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  variable: "all" | "dap" | "alt";
}) {
  const dapScale = niceScale(
    rows.flatMap((r) => [r.dapMax ?? 0, ...r.dapDots]),
    MIN_DAP_SCALE
  );
  const heightScale = niceScale(
    rows.flatMap((r) => [r.heightMax ?? 0, ...r.altDots]),
    MIN_HEIGHT_SCALE
  );
  return (
    <Panel
      aria-labelledby="h-esp"
      className="flex flex-col gap-4 p-5 sm:p-[22px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-bold text-lg" id="h-esp">
              Rango esperado por especie
            </h2>
            <span className="text-[13px] text-ink-3">
              Cada barra muestra el rango normal de la especie y dónde cayeron
              las mediciones atípicas.
            </span>
          </div>
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[860px] flex-col gap-2">
          <div className="grid grid-cols-[minmax(190px,1fr)_minmax(280px,1.6fr)_minmax(280px,1.6fr)] gap-5 px-3.5 font-semibold text-ink-3 text-xs">
            <span>Especie · toca para filtrar</span>
            <span>Diámetro (DAP) · cm</span>
            <span>Altura · m</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-3.5 py-6 text-ink-3 text-sm">
              Aún no hay mediciones con estos filtros.
            </p>
          ) : null}
          {rows.map((s) => {
            const on = selected === s.id;
            return (
              <div
                className={cn(
                  "grid grid-cols-[minmax(190px,1fr)_minmax(280px,1.6fr)_minmax(280px,1.6fr)] items-center gap-5 rounded-md px-3.5 py-2.5",
                  on
                    ? "bg-sel outline-2 outline-primary -outline-offset-2"
                    : "border-line-2 border-t bg-white",
                  selected !== null && !on && "opacity-50"
                )}
                key={s.id}
              >
                <button
                  aria-pressed={on}
                  className="flex min-h-[52px] cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
                  onClick={() => onSelect(on ? null : s.id)}
                  type="button"
                >
                  <span className="flex flex-col gap-0.5">
                    <strong className="font-semibold text-[15px]">
                      {s.name}
                    </strong>
                    <span className="text-ink-3 text-xs">
                      {fmtInt(s.n)} mediciones
                    </span>
                  </span>
                </button>
                <Bar
                  dots={s.dapDots}
                  hi={s.dapMax}
                  lo={s.dapMin ?? 1}
                  mean={s.dapMean}
                  out={s.dapOut}
                  outLabel="atípicos"
                  scale={dapScale}
                  showDots={variable !== "alt"}
                  unit="cm"
                />
                <Bar
                  dots={s.altDots}
                  hi={s.heightMax}
                  lo={LOW_HEIGHT}
                  mean={s.heightMean}
                  out={s.altOut}
                  outLabel="atípicas"
                  scale={heightScale}
                  showDots={variable !== "dap"}
                  unit="m"
                />
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
