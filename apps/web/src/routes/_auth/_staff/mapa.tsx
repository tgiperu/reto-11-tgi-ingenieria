import { formatDistance } from "@reto-11-tgi-ingenieria/domain/geo";
import { normalizeKey } from "@reto-11-tgi-ingenieria/domain/names";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { buttonClass } from "@/components/app/button";
import { PlotStatusChip } from "@/components/app/chip";
import { PageHeader, Panel } from "@/components/app/panel";
import {
  type MapLayers,
  PlotMap,
  STATUS_COLORS,
} from "@/features/mapa/plot-map";
import { fmtInt, fmtIsoDay, fmtNum } from "@/lib/format";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/_staff/mapa")({
  component: MapPage,
});

const LEGEND = [
  { color: STATUS_COLORS.assigned, label: "Asignada" },
  { color: STATUS_COLORS.review, label: "En revisión" },
  { color: STATUS_COLORS.alert, label: "Con alertas", square: true },
  { color: STATUS_COLORS.locked, label: "Bloqueada" },
  { color: STATUS_COLORS.unlocked, label: "Desbloqueada" },
] as const;

const DEVIATION_WARN_M = 100;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-line border-l pl-2.5 first:border-l-0 first:pl-0">
      <span className="text-ink-3 text-xs">{label}</span>
      <strong className="font-mono text-xl">{value}</strong>
    </div>
  );
}

function MapPage() {
  const { data: plots = [], isPending } = useQuery(
    trpc.plots.map.queryOptions()
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [layers, setLayers] = useState<MapLayers>({
    anp: true,
    cabinet: false,
    plots: true,
    strata: false,
  });

  const matching = useMemo(() => {
    const q = normalizeKey(query);
    if (q === "") {
      return null;
    }
    return new Set(
      plots
        .filter((p) =>
          normalizeKey(
            `${p.number} p ${p.sector} ${p.stratum} ${p.topSpecies.join(" ")}`
          ).includes(q)
        )
        .map((p) => p.number)
    );
  }, [plots, query]);

  const current = plots.find((p) => p.number === selected) ?? plots[0] ?? null;
  const toggle = (key: keyof MapLayers) =>
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  const deviation = current?.deviationM ?? null;

  return (
    <>
      <PageHeader
        actions={
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-edge bg-white px-3 text-sm">
            <Search aria-hidden="true" className="text-ink-3" size={16} />
            <span className="sr-only">Buscar parcela</span>
            <input
              className="w-[210px] border-0 bg-transparent text-sm outline-none"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar N°, sector o especie"
              type="search"
              value={query}
            />
          </label>
        }
        subtitle={`${plots.length} parcelas · UTM WGS84 zona 17S convertidas a lat/lon · haz clic en un punto`}
        title="Mapa de parcelas"
      />

      <div className="flex flex-wrap items-stretch gap-4">
        <section
          aria-label="Mapa"
          className="relative h-[680px] min-w-0 flex-[999_1_520px] overflow-hidden rounded-lg border border-edge bg-sunken"
        >
          {isPending ? null : (
            <PlotMap
              layers={layers}
              matching={matching}
              onSelect={setSelected}
              plots={plots}
              selected={current?.number ?? null}
            />
          )}
          <fieldset className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 rounded-md border border-edge bg-white px-3 py-2.5 text-xs">
            <legend className="sr-only">Capas</legend>
            <strong>Capas</strong>
            {(
              [
                ["plots", "Parcelas"],
                ["anp", "Límites ANP"],
                ["strata", "Color por estrato"],
                ["cabinet", "Coord. de gabinete"],
              ] as const
            ).map(([key, label]) => (
              <label className="flex min-h-7 items-center gap-2" key={key}>
                <input
                  checked={layers[key]}
                  className="size-4 accent-primary"
                  onChange={() => toggle(key)}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap gap-3 rounded-md border border-edge bg-white px-3 py-2 text-xs">
            {LEGEND.map((l) => (
              <span className="flex items-center gap-1.5" key={l.label}>
                <span
                  className={`size-3 ${"square" in l ? "rounded-[3px]" : "rounded-full"}`}
                  style={{ background: l.color }}
                />
                {l.label}
              </span>
            ))}
          </div>
        </section>

        <Panel
          aria-label="Detalle de parcela"
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 rounded-lg p-5"
        >
          {current ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="font-mono font-semibold text-3xl">
                    <span className="sr-only">Parcela </span>P-{current.number}
                  </h2>
                </div>
                <PlotStatusChip status={current.status} />
              </div>
              <div className="font-semibold text-[15px]">
                {current.sector} · {current.stratum}
              </div>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt className="text-ink-3">Jefe de brigada</dt>
                <dd>{current.leader ?? "—"}</dd>
                <dt className="text-ink-3">Matero</dt>
                <dd>{current.crew ?? "—"}</dd>
                <dt className="text-ink-3">Fecha</dt>
                <dd>{fmtIsoDay(current.sampleDate)}</dd>
                <dt className="text-ink-3">Coord. campo</dt>
                <dd className="font-mono">
                  {current.utmE === null
                    ? "—"
                    : `E ${Math.round(current.utmE)} · N ${Math.round(current.utmN ?? 0)}`}
                </dd>
                <dt className="text-ink-3">Desvío vs. gabinete</dt>
                <dd
                  className={`font-mono ${deviation !== null && deviation > DEVIATION_WARN_M ? "font-semibold text-crit-fg" : ""}`}
                >
                  {deviation === null ? "—" : formatDistance(deviation)}
                </dd>
                <dt className="text-ink-3">Diseño</dt>
                <dd>Circular anidada · r 30 / 20 / 10 m</dd>
              </dl>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Individuos" value={fmtInt(current.individuals)} />
                <Stat label="Especies" value={fmtInt(current.species)} />
                <Stat label="tC/ha" value={fmtNum(current.carbon)} />
              </div>
              <div className="flex flex-col gap-1.5 text-[13px]">
                <strong>Por categoría</strong>
                <div className="flex justify-between">
                  <span>Latizal alto / fustal (r 30 m)</span>
                  <span className="font-mono">
                    {fmtInt(current.categoryCounts.la)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Arbusto grande (r 20 m)</span>
                  <span className="font-mono">
                    {fmtInt(current.categoryCounts.ar)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Brinzal (r 10 m)</span>
                  <span className="font-mono">
                    {fmtInt(current.categoryCounts.br)}
                  </span>
                </div>
              </div>
              <div className="text-[13px]">
                <strong>Especies dominantes:</strong>{" "}
                {current.topSpecies.length > 0
                  ? current.topSpecies.join(", ")
                  : "—"}
              </div>
              {current.alerts > 0 ? (
                <div className="flex items-start gap-2 rounded-md bg-warn-bg px-3 py-2.5 text-[13px] text-warn-fg">
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 flex-none"
                    size={16}
                  />
                  <span>{current.alerts} alertas abiertas en esta parcela</span>
                </div>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2">
                <Link
                  className={buttonClass(
                    "primary",
                    "md",
                    "min-w-[140px] flex-1 no-underline"
                  )}
                  search={{ plot: current.number }}
                  to="/parcelas"
                >
                  Ver registros
                </Link>
                <Link
                  className={buttonClass(
                    "secondary",
                    "md",
                    "min-w-[140px] flex-1 no-underline"
                  )}
                  to="/"
                >
                  Reporte general
                </Link>
              </div>
            </>
          ) : (
            <p className="text-ink-3 text-sm">
              Aún no hay parcelas. Crea una en Parcelas o importa el archivo del
              inventario.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
