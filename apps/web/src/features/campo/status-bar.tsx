import { healthLabel } from "@reto-11-tgi-ingenieria/domain/health";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
import { campoDb } from "@/lib/offline/db";
import { resetSyncPhase, syncNow, useSyncState } from "@/lib/offline/sync";
import { downloadWorkbook } from "@/lib/xlsx";

import { useBundleMeta, usePendingCount } from "./hooks";

type Theme = "offline" | "syncing" | "ok";

const THEMES: Record<Theme, { bar: string; btn: string; badge: string }> = {
  offline: {
    badge: "bg-crit text-white",
    bar: "bg-warn text-ink",
    btn: "text-ink",
  },
  ok: {
    badge: "bg-signal text-primary",
    bar: "bg-black text-signal",
    btn: "text-white",
  },
  syncing: {
    badge: "bg-white text-primary",
    bar: "bg-info text-white",
    btn: "text-white",
  },
};

export async function exportBackup(fileName: string): Promise<number> {
  const records = await campoDb.records.orderBy("createdAt").toArray();
  await downloadWorkbook(fileName, [
    {
      headers: [
        "Parcela",
        "Categoría",
        "N°",
        "Especie",
        "DAP por eje (cm)",
        "D. equivalente (cm)",
        "Altura (m)",
        "Copa menor (m)",
        "Copa mayor (m)",
        "DAC 1 (cm)",
        "DAC 2 (cm)",
        "Estado sanitario",
        "Fecha",
        "Remedición",
        "Alertas",
        "Observaciones",
        "Estado",
      ],
      name: "Registros",
      rows: records.map((r) => [
        `P-${r.plotNumber}`,
        r.category,
        r.code,
        r.speciesName,
        r.stems.join(" · "),
        r.dapEq === null ? "" : Number(r.dapEq.toFixed(2)),
        r.height ?? "",
        r.crownMin ?? "",
        r.crownMax ?? "",
        r.dac1 ?? "",
        r.dac2 ?? "",
        r.health ? healthLabel(r.health) : "",
        fmtDateTime(r.measuredAt),
        r.isRemeasure ? "Sí" : "No",
        r.alertTitles.join("; "),
        r.notes,
        ["Por enviar", "Enviado", "Rechazado"][r.sent] ?? "",
      ]),
    },
  ]);
  return records.length;
}

export function StatusBar() {
  const { online, phase, message } = useSyncState();
  const pending = usePendingCount();
  const bundle = useBundleMeta();
  const [note, setNote] = useState("");

  let theme: Theme = "ok";
  let text = "Conectado";
  if (!online) {
    theme = "offline";
    text = `Sin conexión · ${pending} sin enviar`;
  } else if (phase === "syncing") {
    theme = "syncing";
    text = message || "Conectado · sincronizando…";
  } else if (phase === "error") {
    theme = "offline";
    text = message || "No se pudo sincronizar";
  }
  const t = THEMES[theme];

  async function onSync() {
    if (!online) {
      toast.warning(
        "Sin conexión: tus registros siguen guardados en el equipo."
      );
      return;
    }
    try {
      const res = await syncNow();
      if (res.rejected > 0) {
        toast.warning(
          `${res.sent} enviados · ${res.rejected} rechazados (revísalos en Inicio)`
        );
      } else {
        toast.success(
          res.sent > 0
            ? `${res.sent} registros enviados y bloqueados`
            : "Todo al día"
        );
      }
    } catch {
      toast.error("No se pudo sincronizar. Intenta de nuevo con mejor señal.");
    } finally {
      setTimeout(resetSyncPhase, 4000);
    }
  }

  async function onBackup() {
    const name = `inventario-${bundle?.user.brigadeId ?? "campo"}.xlsx`;
    try {
      const n = await exportBackup(name);
      setNote(`Respaldo guardado: ${name} (${n} registros)`);
      setTimeout(() => setNote(""), 6000);
    } catch {
      toast.error("No se pudo generar el respaldo");
    }
  }

  const label =
    pending > 0
      ? `Sincronizar: ${pending} registros pendientes`
      : "Sincronizar: todo enviado";
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 pr-2 pl-4 font-medium text-[13px]",
        t.bar
      )}
      role="status"
    >
      {online ? (
        <Wifi aria-hidden="true" size={16} />
      ) : (
        <WifiOff aria-hidden="true" size={16} />
      )}
      <span className="min-w-0 flex-1">{note || text}</span>
      <button
        aria-label={label}
        className={cn(
          "relative flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0",
          t.btn
        )}
        onClick={onSync}
        title="Sincronizar"
        type="button"
      >
        <RefreshCw
          aria-hidden="true"
          className={phase === "syncing" ? "animate-spin" : undefined}
          size={22}
        />
        {pending > 0 ? (
          <span
            className={cn(
              "absolute top-0.5 right-0 min-w-[22px] rounded-[4px] px-1.5 py-px text-center font-bold text-xs",
              t.badge
            )}
          >
            {pending}
          </span>
        ) : null}
      </button>
      <button
        aria-label="Descargar respaldo en el equipo"
        className={cn(
          "flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0",
          t.btn
        )}
        onClick={onBackup}
        title="Respaldo"
        type="button"
      >
        <Download aria-hidden="true" size={22} />
      </button>
    </div>
  );
}
