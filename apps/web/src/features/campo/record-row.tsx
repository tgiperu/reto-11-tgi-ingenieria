import { CATEGORIES } from "@reto-11-tgi-ingenieria/domain/categories";
import { healthLabel } from "@reto-11-tgi-ingenieria/domain/health";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Camera, History, Pencil, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Chip, type Tone } from "@/components/app/chip";
import { fmtDateTime } from "@/lib/format";
import type { LocalRecord, SentState } from "@/lib/offline/db";

const STATE_UI: Record<
  SentState,
  { card: string; divider: string; label: string; tone: Tone }
> = {
  0: {
    card: "bg-warn-bg",
    divider: "border-warn-edge",
    label: "Por enviar",
    tone: "warn",
  },
  1: {
    card: "bg-ok-bg",
    divider: "border-ok-band",
    label: "Enviado",
    tone: "ok",
  },
  2: {
    card: "bg-crit-bg",
    divider: "border-crit/30",
    label: "Rechazado",
    tone: "crit",
  },
};

interface Metric {
  label: string;
  value: string;
}

function average(a: number | null, b: number | null): number | null {
  if (a !== null && b !== null) {
    return (a + b) / 2;
  }
  return a ?? b;
}

/** Las medidas que aplican a la categoría del registro, con lo que realmente se midió. */
function metricsOf(r: LocalRecord): Metric[] {
  const out: Metric[] = [];
  if (r.category === "ar") {
    const crown = average(r.crownMin, r.crownMax);
    if (crown !== null) {
      out.push({ label: "Copa", value: `${crown.toFixed(2)} m` });
    }
  } else if (r.category === "br") {
    const dac = average(r.dac1, r.dac2);
    if (dac !== null) {
      out.push({ label: "DAC", value: `${dac.toFixed(2)} cm` });
    }
  } else if (r.dapEq !== null) {
    out.push({ label: "DAP", value: `${r.dapEq.toFixed(1)} cm` });
    if (r.stems.length > 1) {
      out.push({ label: "Ejes", value: String(r.stems.length) });
    }
  }
  if (r.height !== null) {
    out.push({ label: "Altura", value: `${r.height.toFixed(1)} m` });
  }
  if (r.health) {
    out.push({ label: "Estado", value: healthLabel(r.health) });
  }
  return out;
}

function Flag({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1">{children}</span>;
}

/** Una fila de la lista de registros hechos en este equipo. */
export function RecordRow({ record: r }: { record: LocalRecord }) {
  const ui = STATE_UI[r.sent];
  const editable = r.sent !== 1;
  const metrics = metricsOf(r);
  const alertCount = r.alertTitles.length;
  const hasFlags = Boolean(r.photo) || r.isRemeasure || alertCount > 0;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <strong className="truncate text-base">
            <span className="font-mono">N° {r.code}</span> · {r.speciesName}
          </strong>
          <span className="text-ink-2 text-sm">
            P-{r.plotNumber} · {CATEGORIES[r.category].name} ·{" "}
            {fmtDateTime(r.measuredAt)}
          </span>
        </div>
        <Chip className="bg-white/80" tone={ui.tone}>
          {ui.label}
        </Chip>
      </div>
      {metrics.length > 0 ? (
        <dl
          className={cn(
            "m-0 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-2",
            ui.divider
          )}
        >
          {metrics.map((m) => (
            <div className="flex flex-col" key={m.label}>
              <dt className="text-ink-2 text-xs">{m.label}</dt>
              <dd className="m-0 font-semibold text-sm">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {hasFlags ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2 text-sm">
          {r.isRemeasure ? (
            <Flag>
              <History aria-hidden="true" size={14} /> Remedición
            </Flag>
          ) : null}
          {r.photo ? (
            <Flag>
              <Camera aria-hidden="true" size={14} /> Foto
            </Flag>
          ) : null}
          {alertCount > 0 ? (
            <span className="flex items-center gap-1 font-semibold text-warn-fg">
              <TriangleAlert aria-hidden="true" size={14} />
              {alertCount === 1 ? "1 alerta" : `${alertCount} alertas`}
            </span>
          ) : null}
        </div>
      ) : null}
      {r.sent === 2 && r.error ? (
        <span className="font-semibold text-crit-fg text-sm">{r.error}</span>
      ) : null}
      {editable ? (
        <span className="flex items-center gap-1.5 font-semibold text-sm">
          <Pencil aria-hidden="true" size={14} /> Toca para editar
        </span>
      ) : null}
    </>
  );
  return (
    <li
      className={cn("rounded-lg shadow-[0_1px_4px_rgb(27_27_24/16%)]", ui.card)}
    >
      {editable ? (
        <Link
          className="flex flex-col gap-2 rounded-lg p-3.5 text-ink no-underline active:bg-black/5"
          search={{ editar: r.clientId }}
          to="/campo/registro"
        >
          {content}
        </Link>
      ) : (
        <div className="flex flex-col gap-2 p-3.5">{content}</div>
      )}
    </li>
  );
}
