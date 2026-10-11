import { CATEGORIES } from "@reto-11-tgi-ingenieria/domain/categories";
import { Camera, TriangleAlert } from "lucide-react";

import { Chip, type Tone } from "@/components/app/chip";
import { fmtDateTime } from "@/lib/format";
import type { LocalRecord, SentState } from "@/lib/offline/db";

const STATE_UI: Record<SentState, { label: string; tone: Tone }> = {
  0: { label: "Por enviar", tone: "warn" },
  1: { label: "Enviado", tone: "ok" },
  2: { label: "Rechazado", tone: "crit" },
};

/** Una fila de la lista de registros hechos en este equipo. */
export function RecordRow({ record: r }: { record: LocalRecord }) {
  const ui = STATE_UI[r.sent];
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-white p-3.5 shadow-[0_1px_4px_rgb(27_27_24/16%)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <strong className="truncate text-base">
            <span className="font-mono">N° {r.code}</span> · {r.speciesName}
          </strong>
          <span className="text-ink-3 text-sm">
            P-{r.plotNumber} · {CATEGORIES[r.category].name} ·{" "}
            {fmtDateTime(r.measuredAt)}
          </span>
        </div>
        <Chip tone={ui.tone}>{ui.label}</Chip>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2 text-sm">
        {r.dapEq === null ? null : (
          <span className="font-mono">DAP {r.dapEq.toFixed(1)} cm</span>
        )}
        {r.height === null ? null : (
          <span className="font-mono">H {r.height.toFixed(1)} m</span>
        )}
        {r.photo ? (
          <span className="flex items-center gap-1">
            <Camera aria-hidden="true" size={14} /> Foto
          </span>
        ) : null}
        {r.alertTitles.length > 0 ? (
          <span className="flex items-center gap-1 text-warn-fg">
            <TriangleAlert aria-hidden="true" size={14} />
            {r.alertTitles.length === 1
              ? "1 alerta"
              : `${r.alertTitles.length} alertas`}
          </span>
        ) : null}
      </div>
      {r.sent === 2 && r.error ? (
        <span className="text-crit-fg text-sm">{r.error}</span>
      ) : null}
    </li>
  );
}
