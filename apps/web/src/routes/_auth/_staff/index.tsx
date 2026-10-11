import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleCheck,
  Download,
  ListFilter,
  Ruler,
  TriangleAlert,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import type { ComboItem } from "@/components/app/combobox";
import { exportOutliers } from "@/features/panel/export";
import { Feed } from "@/features/panel/feed";
import {
  DEFAULT_FILTERS,
  FilterBar,
  type PanelFilters,
} from "@/features/panel/filters";
import { SpeciesRanges } from "@/features/panel/species-ranges";
import { PhotoModal, type PhotoTarget } from "@/features/parcelas/modals";
import { fmtInt } from "@/lib/format";
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
}: {
  icon: ReactNode;
  value: number;
  label: string;
  tone: "plain" | "warn" | "ok";
}) {
  const color = {
    ok: "text-ok-fg",
    plain: "text-ink-2",
    warn: "text-warn-fg",
  }[tone];
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5">
      <span
        className={`flex min-w-0 items-center gap-2 font-semibold text-sm ${color}`}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="font-mono font-semibold text-2xl leading-none">
        {fmtInt(value)}
      </span>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: página de panel con varios filtros, paginaciones y diálogos que no ganan claridad al dividirse
function PanelPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PanelFilters>(DEFAULT_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [feedPage, setFeedPage] = useState(0);
  const [speciesPage, setSpeciesPage] = useState(0);
  const [speciesFilterId, setSpeciesFilterId] = useState(0);
  const [photo, setPhoto] = useState<PhotoTarget | null>(null);

  const overview = useQuery({
    ...trpc.dashboard.overview.queryOptions({
      ...filters,
      feedPage,
      speciesPage,
      speciesFilterId: speciesFilterId === 0 ? null : speciesFilterId,
    }),
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
  // Al cambiar los filtros se vuelve a la primera página.
  const filtersKey = JSON.stringify(filters);
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo reacciona al cambio de filtros
  useEffect(() => {
    setFeedPage(0);
    setSpeciesPage(0);
  }, [filtersKey]);

  const speciesOptions = useQuery(trpc.dashboard.speciesOptions.queryOptions());
  const speciesItems = useMemo<ComboItem<number>[]>(
    () => [
      { id: 0, label: "Todas las especies", name: "Todas las especies" },
      ...(speciesOptions.data ?? []).map((s) => ({
        hint: `${s.n}`,
        id: s.id,
        label: s.name,
        name: s.name,
      })),
    ],
    [speciesOptions.data]
  );

  const seen = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const { data } = overview;
  useEffect(() => {
    if (!data || feedPage !== 0) {
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
  }, [data, feedPage]);

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
      const summary = await exportOutliers(rows, speciesName);
      toast.success("Excel exportado", {
        description: `${summary.fileName} · ${summary.species} especies · ${summary.plots} parcelas`,
      });
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
          icon={<Check size={14} />}
          label="Validadas"
          tone="ok"
          value={kpis?.validated ?? 0}
        />
        <Kpi
          icon={<Ruler size={14} />}
          label="DAP atípico"
          tone="warn"
          value={kpis?.dapOut ?? 0}
        />
        <Kpi
          icon={<TriangleAlert size={14} />}
          label="Altura atípica"
          tone="warn"
          value={kpis?.altOut ?? 0}
        />
        <Kpi
          icon={<CircleCheck size={14} />}
          label="Por revisar"
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
        onPage={setFeedPage}
        onPhoto={(item) =>
          setPhoto({
            at: item.syncedAt,
            id: item.measurementId,
            plot: item.plot,
            species: item.species,
          })
        }
        onRemeasure={(measurementId) =>
          resolve.mutate({ action: "remeasure", measurementId })
        }
        onStatus={(status) => setFilters({ ...filters, status })}
        page={feedPage}
        pageSize={data?.feedPageSize ?? 10}
        status={filters.status}
        total={data?.feedTotal ?? 0}
      />

      <PhotoModal onClose={() => setPhoto(null)} target={photo} />

      <SpeciesRanges
        filterId={speciesFilterId}
        onFilter={(id) => {
          setSpeciesFilterId(id);
          setSpeciesPage(0);
        }}
        onPage={setSpeciesPage}
        onSelect={(speciesId) => setFilters({ ...filters, speciesId })}
        options={speciesItems}
        page={speciesPage}
        pageSize={data?.speciesPageSize ?? 5}
        rows={data?.species ?? []}
        selected={filters.speciesId}
        total={data?.speciesTotal ?? 0}
        variable={filters.variable}
      />
    </>
  );
}
