import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleCheck,
  Download,
  ListFilter,
  Ruler,
  TriangleAlert,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { Notice } from "@/components/app/panel";
import { type ExportSummary, exportOutliers } from "@/features/panel/export";
import { Feed } from "@/features/panel/feed";
import {
  DEFAULT_FILTERS,
  FilterBar,
  type PanelFilters,
} from "@/features/panel/filters";
import { SpeciesRanges } from "@/features/panel/species-ranges";
import { fmtInt, fmtTimeSeconds } from "@/lib/format";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/_staff/")({
  component: PanelPage,
});

const REFRESH_MS = 8000;

function Kpi({
  icon,
  value,
  label,
  tone,
  hint,
  on,
  onPick,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  tone: "plain" | "warn" | "ok";
  hint: string;
  on: boolean;
  onPick: () => void;
}) {
  const color = {
    ok: "text-ok-fg",
    plain: "text-ink-2",
    warn: "text-warn-fg",
  }[tone];
  return (
    <button
      aria-pressed={on}
      className={`flex min-w-0 cursor-pointer flex-col items-start gap-1 px-4 py-3 text-left hover:bg-sunken ${on ? "bg-sel" : "bg-transparent"}`}
      onClick={onPick}
      title={hint}
      type="button"
    >
      <span
        className={`flex items-center gap-1.5 font-semibold text-xs ${color}`}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="font-mono font-semibold text-[30px] leading-none">
        {fmtInt(value)}
      </span>
    </button>
  );
}

function PanelPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PanelFilters>(DEFAULT_FILTERS);
  const [exported, setExported] = useState<ExportSummary | null>(null);
  const [exporting, setExporting] = useState(false);

  const overview = useQuery({
    ...trpc.dashboard.overview.queryOptions(filters),
    placeholderData: (previous) => previous,
    refetchInterval: REFRESH_MS,
  });
  const resolve = useMutation(
    trpc.dashboard.resolve.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: () => queryClient.invalidateQueries(),
    })
  );

  // Las mediciones que aparecen después de la primera carga se marcan como NUEVA.
  const seen = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const { data } = overview;
  useEffect(() => {
    if (!data) {
      return;
    }
    const ids = data.feed.map((f) => f.id);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current?.has(id));
    for (const id of ids) {
      seen.current.add(id);
    }
    if (fresh.length > 0) {
      setNewIds(new Set(fresh));
    }
  }, [data]);

  const speciesName = useMemo(
    () => data?.species.find((s) => s.id === filters.speciesId)?.name ?? null,
    [data, filters.speciesId]
  );

  async function onExport() {
    setExporting(true);
    try {
      const rows = await queryClient.fetchQuery(
        trpc.dashboard.export.queryOptions(filters)
      );
      setExported(await exportOutliers(rows, speciesName, filters.variable));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo exportar"
      );
    } finally {
      setExporting(false);
    }
  }

  const kpis = data?.kpis;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-balance font-bold text-[26px] leading-tight tracking-tight">
            Validación de diámetros y alturas atípicas
          </h1>
          <p className="hidden max-w-[68ch] font-serif text-[15px] text-ink-3 leading-relaxed sm:block">
            Evaluación de parcelas adicionales de carbono · PNCAM y CCEAN.
            Acepta el valor si es correcto o pide una nueva medición en campo.
          </p>
          <span className="flex items-center gap-2 font-medium text-[13px] text-ok-fg">
            <span className="live-dot size-[9px] rounded-full bg-ok" />
            En vivo · última medición recibida{" "}
            <span className="font-mono">
              {data?.lastReceivedAt ? fmtTimeSeconds(data.lastReceivedAt) : "—"}
            </span>
          </span>
        </div>
        <Button
          aria-label="Exportar a Excel"
          disabled={exporting || !data}
          onClick={onExport}
          variant="primary"
        >
          <Download aria-hidden="true" size={18} />
          {exporting ? "Exportando…" : "Exportar a Excel"}
        </Button>
      </header>

      {exported ? (
        <Notice
          className="flex flex-wrap items-center justify-between gap-3"
          tone="ok"
        >
          <div className="flex flex-col gap-0.5">
            <strong className="text-sm">Descargado: {exported.fileName}</strong>
            <span>
              3 hojas: Resumen por especie ({exported.species} especies) ·
              Atípicos DAP ({exported.rowsDap} filas) · Atípicos altura (
              {exported.rowsAlt} filas). Respeta los filtros aplicados.
            </span>
          </div>
          <Button
            aria-label="Cerrar aviso"
            onClick={() => setExported(null)}
            size="sm"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </Notice>
      ) : null}

      <details className="border-line border-y sm:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-sm">
          <ListFilter aria-hidden="true" size={16} /> Filtros
        </summary>
        <FilterBar
          dataRange={data?.dataRange ?? { max: null, min: null }}
          filters={filters}
          onChange={setFilters}
          speciesName={speciesName}
        />
      </details>
      <div className="hidden sm:block">
        <FilterBar
          dataRange={data?.dataRange ?? { max: null, min: null }}
          filters={filters}
          onChange={setFilters}
          speciesName={speciesName}
        />
      </div>

      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 divide-line overflow-hidden rounded-lg border border-line bg-white sm:grid-cols-4 sm:divide-x [&>*:nth-child(n+3)]:border-line [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0"
      >
        <Kpi
          hint="Sin alerta o ya aceptadas: ver resueltas"
          icon={<Check size={14} />}
          label="Validadas"
          on={filters.status === "done" && filters.variable === "all"}
          onPick={() =>
            setFilters({ ...filters, status: "done", variable: "all" })
          }
          tone="ok"
          value={kpis?.validated ?? 0}
        />
        <Kpi
          hint="Fuera de media ± k·DE: ver solo DAP"
          icon={<Ruler size={14} />}
          label="DAP atípico"
          on={filters.variable === "dap" && filters.status === "open"}
          onPick={() =>
            setFilters({ ...filters, status: "open", variable: "dap" })
          }
          tone="warn"
          value={kpis?.dapOut ?? 0}
        />
        <Kpi
          hint="Sobre el máximo de la especie: ver solo altura"
          icon={<TriangleAlert size={14} />}
          label="Altura atípica"
          on={filters.variable === "alt" && filters.status === "open"}
          onPick={() =>
            setFilters({ ...filters, status: "open", variable: "alt" })
          }
          tone="warn"
          value={kpis?.altOut ?? 0}
        />
        <Kpi
          hint="Sin aceptar ni re-medir"
          icon={<CircleCheck size={14} />}
          label="Por revisar"
          on={filters.status === "open" && filters.variable === "all"}
          onPick={() =>
            setFilters({ ...filters, status: "open", variable: "all" })
          }
          tone="plain"
          value={kpis?.pending ?? 0}
        />
      </section>

      <Feed
        busy={resolve.isPending}
        count={data?.counts.all ?? 0}
        counts={data?.counts ?? { all: 0, done: 0, open: 0 }}
        items={data?.feed ?? []}
        newIds={newIds}
        onAccept={(measurementId) =>
          resolve.mutate({ action: "accept", measurementId })
        }
        onRemeasure={(measurementId) =>
          resolve.mutate({ action: "remeasure", measurementId })
        }
        onStatus={(status) => setFilters({ ...filters, status })}
        status={filters.status}
      />

      <SpeciesRanges
        onSelect={(speciesId) => setFilters({ ...filters, speciesId })}
        rows={data?.species ?? []}
        selected={filters.speciesId}
        variable={filters.variable}
      />
    </>
  );
}
