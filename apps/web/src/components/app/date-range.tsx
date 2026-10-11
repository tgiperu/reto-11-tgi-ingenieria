import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  addDays,
  dayDiff,
  monthCells,
  monthName,
  parseIso,
  todayLima,
} from "@/lib/dates";
import { fmtIsoDay } from "@/lib/format";

import { Button } from "./button";

const WEEKDAYS = ["LU", "MA", "MI", "JU", "VI", "SÁ", "DO"] as const;

interface Props {
  from: string | null;
  max: string | null;
  min: string | null;
  onApply: (from: string, to: string) => void;
  onCancel: () => void;
  to: string | null;
}

function dayClass(
  selected: boolean,
  inData: boolean,
  weekend: boolean
): string {
  if (selected) {
    return "cursor-pointer bg-primary font-bold text-white";
  }
  if (!inData) {
    return "cursor-default bg-line-2 text-ink-3";
  }
  return cn(
    "cursor-pointer hover:ring-2 hover:ring-primary",
    weekend ? "text-ink-3" : "text-ink"
  );
}

function rangeStatus(
  ready: boolean,
  days: number,
  from: string | null
): string {
  if (ready) {
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  return from ? "Ahora elige el día final" : "Elige el día de inicio";
}

function MonthGrid({
  year,
  month,
  min,
  max,
  from,
  to,
  onPick,
}: {
  year: number;
  month: number;
  min: string;
  max: string;
  from: string | null;
  to: string | null;
  onPick: (iso: string) => void;
}) {
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  return (
    <div className="flex min-w-[210px] flex-[1_1_210px] flex-col gap-1 rounded-md border border-line-2 bg-sheet px-1.5 pt-2 pb-1.5">
      <strong className="pb-0.5 text-center text-[13px] capitalize">
        {monthName(month)} {year}
      </strong>
      <div
        aria-hidden="true"
        className="grid grid-cols-7 text-center font-bold text-ink-3 text-xs tracking-wide"
      >
        {WEEKDAYS.map((d, i) => (
          <span className={i >= 5 ? "text-ink-3" : undefined} key={d}>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-px">
        {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse */}
        {cells.map((cell, index) => {
          if (!cell.iso || cell.day === null) {
            return (
              <div
                className="min-h-[34px]"
                // biome-ignore lint/suspicious/noArrayIndexKey: la posición es la identidad de este elemento
                key={`blank-${year}-${month}-${index}`}
              />
            );
          }
          const { iso } = cell;
          const inData = iso >= min && iso <= max;
          const isStart = iso === from;
          const isEnd = iso === to;
          const inRange = Boolean(from && to && iso > from && iso < to);
          return (
            <div
              className={cn(
                "flex min-h-[34px] items-center justify-center",
                inRange && "bg-sel",
                isStart &&
                  to &&
                  to !== from &&
                  "bg-linear-to-r from-50% from-transparent to-50% to-sel",
                isEnd &&
                  from &&
                  to !== from &&
                  "bg-linear-to-l from-50% from-transparent to-50% to-sel"
              )}
              key={iso}
            >
              <button
                aria-label={`${cell.day} de ${monthName(month)} de ${year}${inData ? "" : ", sin datos"}`}
                aria-pressed={isStart || isEnd}
                className={cn(
                  "size-[34px] rounded-full text-xs",
                  dayClass(isStart || isEnd, inData, cell.weekend)
                )}
                disabled={!inData}
                onClick={() => onPick(iso)}
                type="button"
              >
                {cell.day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  min,
  max,
  from,
  to,
  onApply,
  onCancel,
}: Props) {
  const lo = min ?? todayLima();
  const hi = max ?? todayLima();
  const hiParts = parseIso(hi);
  const [draftFrom, setDraftFrom] = useState<string | null>(from);
  const [draftTo, setDraftTo] = useState<string | null>(to);
  const [monthIndex, setMonthIndex] = useState(
    hiParts.year * 12 + hiParts.month - 1
  );

  const pick = (iso: string) => {
    if (!draftFrom || draftTo) {
      setDraftFrom(iso);
      setDraftTo(null);
    } else if (iso < draftFrom) {
      setDraftFrom(iso);
    } else {
      setDraftTo(iso);
    }
  };
  const preset = (a: string, b: string) => {
    setDraftFrom(a < lo ? lo : a);
    setDraftTo(b);
  };
  const ready = Boolean(draftFrom && draftTo);
  const days = draftFrom && draftTo ? dayDiff(draftFrom, draftTo) + 1 : 0;
  const presets = [
    { a: addDays(hi, -6), b: hi, label: "Últimos 7 días" },
    { a: addDays(hi, -13), b: hi, label: "Últimos 14 días" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 font-semibold text-ink-3 text-xs">Atajos</span>
        {presets.map((p) => {
          const on = draftFrom === (p.a < lo ? lo : p.a) && draftTo === p.b;
          return (
            <button
              className={cn(
                "min-h-8 cursor-pointer rounded-md border px-2.5 text-xs",
                on
                  ? "border-primary bg-sel font-semibold"
                  : "border-edge bg-white"
              )}
              key={p.label}
              onClick={() => preset(p.a, p.b)}
              type="button"
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-stretch gap-2.5">
        {[
          {
            active: !draftFrom || Boolean(draftTo),
            label: "Desde",
            value: draftFrom,
          },
          {
            active: Boolean(draftFrom) && !draftTo,
            label: "Hasta",
            value: draftTo,
          },
        ].map((f, i) => (
          <div className="contents" key={f.label}>
            {i === 1 ? (
              <ArrowRight
                aria-hidden="true"
                className="self-center text-ink-3"
                size={20}
              />
            ) : null}
            <div
              className={cn(
                "flex flex-[1_1_130px] items-center gap-2 rounded-md border bg-white px-2.5 py-1.5",
                f.active
                  ? "border-primary ring-[3px] ring-primary/15"
                  : "border-line"
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-[26px] items-center justify-center rounded-lg bg-sel text-ink"
              >
                <CalendarDays size={14} />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-bold text-ink-3 text-xs uppercase tracking-wide">
                  {f.label}
                </span>
                <strong className="font-mono text-[13px]">
                  {fmtIsoDay(f.value)}
                </strong>
              </span>
            </div>
          </div>
        ))}
        <span
          className={cn(
            "ml-auto self-center rounded-[4px] px-2.5 py-1 font-semibold text-xs",
            ready ? "bg-sel text-ok-fg" : "bg-warn-bg text-warn-fg"
          )}
        >
          {rangeStatus(ready, days, draftFrom)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label="Mes anterior"
          onClick={() => setMonthIndex((v) => v - 1)}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </Button>
        <Button
          aria-label="Mes siguiente"
          onClick={() => setMonthIndex((v) => v + 1)}
          size="sm"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[monthIndex, monthIndex + 1].map((idx) => (
          <MonthGrid
            from={draftFrom}
            key={idx}
            max={hi}
            min={lo}
            month={idx % 12}
            onPick={pick}
            to={draftTo}
            year={Math.floor(idx / 12)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="flex items-center gap-2 text-ink-3 text-xs">
          <span className="size-3 rounded-full bg-primary" />
          Inicio / fin
          <span className="h-2.5 w-[18px] rounded-[3px] bg-sel" />
          Rango
          <span className="size-3 rounded-full bg-line-2" />
          Sin datos
        </span>
        <div className="flex gap-2">
          <Button onClick={onCancel} size="sm">
            Cancelar
          </Button>
          <Button
            disabled={!ready}
            onClick={() => draftFrom && draftTo && onApply(draftFrom, draftTo)}
            size="sm"
            variant="primary"
          >
            <Check aria-hidden="true" size={16} /> Aplicar rango
          </Button>
        </div>
      </div>
    </div>
  );
}
