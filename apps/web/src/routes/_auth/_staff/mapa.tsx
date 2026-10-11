import {
  PLOT_STATUS_LABELS,
  PLOT_STATUSES,
} from "@reto-11-tgi-ingenieria/domain/constants";
import { formatDistance } from "@reto-11-tgi-ingenieria/domain/geo";
import { normalizeKey } from "@reto-11-tgi-ingenieria/domain/names";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Crosshair,
  Layers,
  Leaf,
  MapPin,
  Mountain,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "@/components/app/button";
import { PlotStatusChip } from "@/components/app/chip";
import { PageHeader, Panel } from "@/components/app/panel";
import {
  type MapLayers,
  PlotMap,
  STATUS_COLORS,
  STRATUM_COLORS,
} from "@/features/mapa/plot-map";
import { fmtInt, fmtIsoDay, fmtNum } from "@/lib/format";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/_staff/mapa")({
  component: MapPage,
});

const LAYER_OPTIONS = [
  {
    description: "Puntos de cada parcela",
    icon: MapPin,
    key: "plots",
    label: "Parcelas",
  },
  {
    description: "Áreas naturales protegidas",
    icon: Mountain,
    key: "anp",
    label: "Límites ANP",
  },
  {
    description: "Pinta cada parcela según su estrato",
    icon: Leaf,
    key: "strata",
    label: "Color por estrato",
  },
  {
    description: "Punto planificado en gabinete",
    icon: Crosshair,
    key: "cabinet",
    label: "Coord. de gabinete",
  },
] as const;

interface LegendItem {
  color: string;
  count: number;
  key: string;
  label: string;
  square: boolean;
}

function LayersMenu({
  layers,
  onToggle,
}: {
  layers: MapLayers;
  onToggle: (key: keyof MapLayers) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = LAYER_OPTIONS.filter((o) => layers[o.key]).length;
  return (
    <div className="absolute top-3 left-3 z-20" ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Capas del mapa"
        className={`relative flex size-11 cursor-pointer items-center justify-center rounded-md border bg-white shadow-sm hover:bg-sunken ${open ? "border-primary" : "border-edge"}`}
        onClick={() => setOpen((v) => !v)}
        title="Capas del mapa"
        type="button"
      >
        <Layers aria-hidden="true" size={20} />
        <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary font-bold text-[11px] text-white">
          {active}
        </span>
      </button>
      {open ? (
        <fieldset className="absolute top-[52px] left-0 m-0 flex w-[290px] max-w-[calc(100vw-48px)] flex-col gap-1 rounded-xl border border-edge bg-white p-2 shadow-[6px_0_0_rgb(27_27_24/18%)]">
          <legend className="sr-only">Capas</legend>
          <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
            <div className="flex flex-col leading-tight">
              <strong className="text-sm">Capas del mapa</strong>
              <span className="text-ink-3 text-xs">
                {active} de {LAYER_OPTIONS.length} activas
              </span>
            </div>
            <button
              aria-label="Cerrar"
              className="flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink-3 hover:bg-sunken hover:text-ink"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          {LAYER_OPTIONS.map((o) => {
            const on = layers[o.key];
            return (
              <button
                aria-checked={on}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-2.5 py-2 text-left ${on ? "border-primary bg-sel" : "border-transparent bg-transparent hover:bg-sunken"}`}
                key={o.key}
                onClick={() => onToggle(o.key)}
                role="switch"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-9 flex-none items-center justify-center rounded-lg ${on ? "bg-primary text-white" : "bg-sunken text-ink-3"}`}
                >
                  <o.icon size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-semibold text-[13px]">{o.label}</span>
                  <span className="text-ink-3 text-xs">{o.description}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`relative h-[22px] w-10 flex-none rounded-full transition-colors ${on ? "bg-primary" : "bg-edge"}`}
                >
                  <span
                    className="absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[left]"
                    style={{ left: on ? 21 : 3 }}
                  />
                </span>
              </button>
            );
          })}
        </fieldset>
      ) : null}
    </div>
  );
}

function MapLegend({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: LegendItem[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <section
      aria-label={title}
      className="absolute bottom-3 left-3 z-10 flex w-[210px] max-w-[calc(100%-24px)] flex-col gap-1 rounded-lg border border-edge bg-white p-2.5 text-xs shadow-sm"
    >
      <div className="flex items-center justify-between px-1">
        <strong className="text-[13px]">{title}</strong>
        {selected ? (
          <button
            className="cursor-pointer border-0 bg-transparent p-0 text-ink-3 underline hover:text-ink"
            onClick={() => onSelect(null)}
            type="button"
          >
            Ver todas
          </button>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {items.map((item) => {
          const on = selected === item.key;
          return (
            <li key={item.key}>
              <button
                aria-pressed={on}
                className={`flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md border-0 px-1.5 text-left ${on ? "bg-sel font-semibold" : "bg-transparent hover:bg-sunken"} ${selected && !on ? "opacity-55" : ""}`}
                onClick={() => onSelect(on ? null : item.key)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`size-3 flex-none border border-white shadow-[0_0_0_1px_rgb(27_27_24/35%)] ${item.square ? "rounded-[3px]" : "rounded-full"}`}
                  style={{ background: item.color }}
                />
                <span className="flex-1">{item.label}</span>
                <span className="font-mono text-ink-3">{item.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 px-1 pt-0.5 text-[11px] text-ink-3">
        Toca un elemento para resaltarlo en el mapa.
      </p>
    </section>
  );
}

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
  const [legendKey, setLegendKey] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayers>({
    anp: true,
    cabinet: false,
    plots: true,
    strata: false,
  });

  const legend = useMemo<LegendItem[]>(() => {
    if (layers.strata) {
      return Object.entries(STRATUM_COLORS).map(([name, color]) => ({
        color,
        count: plots.filter((p) => p.stratum === name).length,
        key: name,
        label: name,
        square: false,
      }));
    }
    return PLOT_STATUSES.map((status) => ({
      color: STATUS_COLORS[status] ?? "#5E5C54",
      count: plots.filter((p) => p.status === status).length,
      key: status,
      label: PLOT_STATUS_LABELS[status],
      square: status === "alert",
    }));
  }, [plots, layers.strata]);

  const matching = useMemo(() => {
    const q = normalizeKey(query);
    if (q === "" && legendKey === null) {
      return null;
    }
    const legendField = layers.strata ? "stratum" : "status";
    return new Set(
      plots
        .filter(
          (p) =>
            (legendKey === null || p[legendField] === legendKey) &&
            (q === "" ||
              normalizeKey(
                `${p.number} p ${p.sector} ${p.stratum} ${p.topSpecies.join(" ")}`
              ).includes(q))
        )
        .map((p) => p.number)
    );
  }, [plots, query, legendKey, layers.strata]);

  const current = plots.find((p) => p.number === selected) ?? plots[0] ?? null;
  const toggle = (key: keyof MapLayers) => {
    if (key === "strata") {
      setLegendKey(null);
    }
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  };
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
          <LayersMenu layers={layers} onToggle={toggle} />
          <MapLegend
            items={legend}
            onSelect={setLegendKey}
            selected={legendKey}
            title={layers.strata ? "Estrato" : "Estado de la parcela"}
          />
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
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Individuos" value={fmtInt(current.individuals)} />
                <Stat label="Especies" value={fmtInt(current.species)} />
              </div>
              <div className="flex items-center gap-3 rounded-lg border-2 border-ok bg-ok-bg px-4 py-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 flex-none items-center justify-center rounded-full bg-ok text-white"
                >
                  <Leaf size={22} />
                </span>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="font-semibold text-ok-fg text-xs uppercase tracking-wide">
                    Carbono almacenado
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <strong className="font-bold font-mono text-4xl text-ok-fg">
                      {fmtNum(current.carbon)}
                    </strong>
                    <span className="font-semibold text-ok-fg text-sm">
                      tC/ha
                    </span>
                  </span>
                </div>
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
