import {
  HEALTH_LIST,
  type HealthKey,
} from "@reto-11-tgi-ingenieria/domain/health";
import { sanitizePositiveDecimal } from "@reto-11-tgi-ingenieria/domain/measure";
import type { RuleAlert } from "@reto-11-tgi-ingenieria/domain/rules";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { Camera, CircleX, Images, Trash2, TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

import { Button } from "@/components/app/button";

const INPUT =
  "min-h-12 w-full rounded-md border border-field bg-white px-3 font-mono text-base text-ink";

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm">{title}</strong>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function NumField({
  label,
  value,
  onChange,
  large,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  large?: boolean;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-ink-2 text-xs" htmlFor={id}>
        {label}
      </label>
      <input
        aria-invalid={invalid ? true : undefined}
        className={cn(
          INPUT,
          large && "text-xl",
          invalid && "border-2 border-crit-fg"
        )}
        id={id}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        type="text"
        value={value}
      />
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span className="text-ink-2">{label}</span>
      <strong className="font-mono text-lg">{value}</strong>
    </div>
  );
}

export function StemsSection({
  stems,
  code,
  onChange,
  eq,
}: {
  stems: string[];
  code: string;
  onChange: (stems: string[]) => void;
  eq: string;
}) {
  return (
    <Section
      aside={
        <Button
          className="rounded-md border-primary text-ink"
          onClick={() => onChange([...stems, ""])}
          size="sm"
        >
          + Eje
        </Button>
      }
      title="DAP por eje (cm) · a 1.30 m"
    >
      {stems.map((value, i) => {
        const label =
          stems.length > 1 ? `${code || "?"}.${i + 1}` : code || "?";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: los ejes se identifican por su posición
          <div className="flex items-center gap-2.5" key={i}>
            <span className="w-14 flex-none font-mono text-ink-2 text-sm">
              {label}
            </span>
            <div className="flex-1">
              <NumField
                label={`DAP del eje ${i + 1} (cm)`}
                large
                onChange={(v) =>
                  onChange(stems.map((s, j) => (j === i ? v : s)))
                }
                value={value}
              />
            </div>
            {stems.length > 1 ? (
              <Button
                aria-label={`Quitar eje ${i + 1}`}
                className="mt-5"
                onClick={() => onChange(stems.filter((_, j) => j !== i))}
                size="sm"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" size={16} />
              </Button>
            ) : null}
          </div>
        );
      })}
      <div className="flex items-center justify-between border-line border-t border-dashed pt-2 text-[13px]">
        <span className="text-ink-2">D. equivalente √(Σd²)</span>
        <strong className="font-mono text-lg">{eq} cm</strong>
      </div>
    </Section>
  );
}

export function CrownSection({
  min,
  max,
  onMin,
  onMax,
  avg,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  avg: string;
}) {
  return (
    <Section title="Diámetro de copa (m)">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Menor" onChange={onMin} value={min} />
        <NumField label="Mayor" onChange={onMax} value={max} />
      </div>
      <Readout label="Promedio" value={`${avg} m`} />
    </Section>
  );
}

export function DacSection({
  a,
  b,
  onA,
  onB,
  avg,
}: {
  a: string;
  b: string;
  onA: (v: string) => void;
  onB: (v: string) => void;
  avg: string;
}) {
  return (
    <Section title="DAC (cm) · a 5 cm del suelo">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Lectura 1" onChange={onA} value={a} />
        <NumField label="Lectura 2" onChange={onB} value={b} />
      </div>
      <Readout label="Promedio" value={`${avg} cm`} />
    </Section>
  );
}

export type HeightMode = "direct" | "clino";

export function HeightSection({
  mode,
  onMode,
  direct,
  onDirect,
  dist,
  p0,
  p1,
  onDist,
  onP0,
  onP1,
  computed,
  error,
}: {
  mode: HeightMode;
  onMode: (m: HeightMode) => void;
  direct: string;
  onDirect: (v: string) => void;
  dist: string;
  p0: string;
  p1: string;
  onDist: (v: string) => void;
  onP0: (v: string) => void;
  onP1: (v: string) => void;
  computed: string;
  error?: string | null;
}) {
  return (
    <Section
      aside={
        <fieldset
          aria-label="Forma de medir"
          className="m-0 flex min-w-0 gap-1 rounded-md border-0 bg-sunken p-[3px]"
        >
          {(
            [
              ["direct", "Directa"],
              ["clino", "Clinómetro"],
            ] as const
          ).map(([id, label]) => (
            <button
              aria-pressed={mode === id}
              className={cn(
                "min-h-9 cursor-pointer rounded-lg border-0 px-2.5 text-[13px]",
                mode === id
                  ? "bg-white font-semibold shadow-sm"
                  : "bg-transparent text-ink-2"
              )}
              key={id}
              onClick={() => onMode(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </fieldset>
      }
      title="Altura total (m)"
    >
      {mode === "direct" ? (
        <NumField
          invalid={Boolean(error)}
          label="Altura directa en metros"
          large
          onChange={(v) => onDirect(sanitizePositiveDecimal(v))}
          value={direct}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <NumField
              label="Distancia (m)"
              onChange={(v) => onDist(sanitizePositiveDecimal(v))}
              value={dist}
            />
            <NumField label="% base" onChange={onP0} value={p0} />
            <NumField label="% copa" onChange={onP1} value={p1} />
          </div>
          <Readout label="Calculada" value={`${computed} m`} />
        </>
      )}
      {error ? (
        <p className="m-0 font-semibold text-crit-fg text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </Section>
  );
}

export function HealthSection({
  value,
  onChange,
  required,
}: {
  value: HealthKey | null;
  onChange: (value: HealthKey) => void;
  required: boolean;
}) {
  return (
    <Section
      aside={
        <span className="text-ink-3 text-xs">
          {required ? "Obligatorio" : "Opcional en brinzales"}
        </span>
      }
      title="Estado sanitario"
    >
      <fieldset
        aria-label="Estado sanitario"
        className="m-0 grid min-w-0 grid-cols-2 gap-2 border-0 p-0"
      >
        {HEALTH_LIST.map((h) => (
          <button
            aria-pressed={value === h.key}
            className={cn(
              "min-h-12 cursor-pointer rounded-lg border px-2 font-semibold text-[13px]",
              value === h.key
                ? "border-primary bg-primary text-white"
                : "border-field bg-white text-ink"
            )}
            key={h.key}
            onClick={() => onChange(h.key)}
            type="button"
          >
            {h.name}
          </button>
        ))}
      </fieldset>
    </Section>
  );
}

export function PhotoSection({
  photo,
  onPhoto,
  hint,
  warn,
}: {
  photo: Blob | null;
  onPhoto: (photo: Blob | null) => void;
  hint: string;
  warn: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const camera = useId();
  const gallery = useId();
  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(photo);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo]);

  const pick = (file: File | undefined) => {
    if (file) {
      onPhoto(file);
    }
  };
  return (
    <Section
      aside={
        <span
          className={cn(
            "text-xs",
            warn ? "font-semibold text-warn-fg" : "text-ink-3"
          )}
        >
          {hint}
        </span>
      }
      title="Foto del árbol"
    >
      {photo && url ? (
        <div className="relative">
          {/* biome-ignore lint/correctness/useImageSize: imagen de tamaño variable (foto del equipo) */}
          <img
            alt="Foto del árbol registrado"
            className="h-[200px] w-full rounded-lg object-cover"
            src={url}
          />
          <label
            className="absolute bottom-2 left-2 cursor-pointer rounded-lg bg-black/70 px-3 py-2 font-semibold text-[13px] text-white"
            htmlFor={camera}
          >
            Toca para cambiar
          </label>
          <button
            aria-label="Borrar foto"
            className="absolute top-2 right-2 flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-black/75 text-white"
            onClick={() => onPhoto(null)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={20} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label
            className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-primary border-dashed bg-white font-semibold text-ink text-sm"
            htmlFor={camera}
          >
            <Camera aria-hidden="true" size={22} /> Cámara
          </label>
          <label
            className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border border-field bg-white font-semibold text-sm"
            htmlFor={gallery}
          >
            <Images aria-hidden="true" size={22} /> Galería
          </label>
        </div>
      )}
      <input
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={camera}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
        type="file"
      />
      <input
        accept="image/*"
        className="sr-only"
        id={gallery}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
        type="file"
      />
    </Section>
  );
}

export function AlertList({ alerts }: { alerts: readonly RuleAlert[] }) {
  return (
    <>
      {alerts.map((a) => {
        const critical = a.severity === "critical";
        return (
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-[13px]",
              critical
                ? "border-crit/30 bg-crit-bg text-crit-fg"
                : "border-warn-edge bg-warn-bg text-warn-fg"
            )}
            key={`${a.rule}-${a.title}`}
            role="alert"
          >
            {critical ? (
              <CircleX
                aria-hidden="true"
                className="mt-px flex-none"
                size={18}
              />
            ) : (
              <TriangleAlert
                aria-hidden="true"
                className="mt-px flex-none"
                size={18}
              />
            )}
            <div className="flex flex-col gap-1">
              <strong>{a.title}</strong>
              <span>{a.text}</span>
              {a.blocking ? (
                <span className="font-semibold">
                  Corrígelo para poder guardar.
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
