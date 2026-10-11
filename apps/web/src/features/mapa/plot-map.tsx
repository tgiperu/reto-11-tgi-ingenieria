import { utmToLatLon } from "@reto-11-tgi-ingenieria/domain/geo";
import type {
  GeoJSONSourceSpecification,
  Map as MapLibreMap,
  Marker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Maximize, Minus, Plus } from "lucide-react";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef } from "react";

import { Button } from "@/components/app/button";

export interface MapPlot {
  cabE: number | null;
  cabN: number | null;
  lat: number | null;
  lon: number | null;
  number: number;
  sector: string;
  status: string;
  stratum: string;
}

export interface MapLayers {
  anp: boolean;
  cabinet: boolean;
  plots: boolean;
  strata: boolean;
}

export const STATUS_COLORS: Record<string, string> = {
  alert: "#D9730D",
  assigned: "#5E5C54",
  locked: "#257A4A",
  review: "#1D3E8F",
  unlocked: "#C8281E",
};

export const STRATUM_COLORS: Record<string, string> = {
  "Bosque denso": "#1F5A36",
  "Bosque ralo": "#B7C96A",
  "Bosque semidenso": "#4E9A68",
  Incendio: "#C9402F",
  Matorral: "#D9A441",
};

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_CENTER: [number, number] = [-80.5, -4.1];
const DEFAULT_ZOOM = 8;
const MIN_ZOOM = 7;
/** Tumbes y Piura: el mapa no deja salir de esta caja (oeste, sur, este, norte). */
const REGION_BOUNDS: [[number, number], [number, number]] = [
  [-81.4, -5.8],
  [-79.0, -3.3],
];
const FIT_PADDING = 60;
const FOCUS_ZOOM = 12;
const ANP_SOURCE = "anp";

const PIN_SIZE = 28;
const PIN_SIZE_SELECTED = 36;
const COMPACT_ZOOM = 10;

/** El tamaño, la forma y el color van como variables; el resto vive en `.pin` (index.css). */
function pinStyle(
  plot: MapPlot,
  selected: boolean,
  dimmed: boolean,
  byStratum: boolean
): string {
  const color = byStratum
    ? (STRATUM_COLORS[plot.stratum] ?? "#5E5C54")
    : (STATUS_COLORS[plot.status] ?? "#5E5C54");
  return [
    `--pin-size:${selected ? PIN_SIZE_SELECTED : PIN_SIZE}px`,
    `--pin-color:${color}`,
    `--pin-radius:${plot.status === "alert" ? "7px" : "50%"}`,
    `--pin-ring:${selected ? "0 0 0 3px #FFFFFF, 0 0 0 6px #1B1B18" : "0 0 0 2px #FFFFFF"}`,
    `opacity:${dimmed ? 0.3 : 1}`,
  ].join(";");
}

export function PlotMap({
  plots,
  selected,
  onSelect,
  matching,
  layers,
}: {
  plots: MapPlot[];
  selected: number | null;
  onSelect: (n: number) => void;
  matching: ReadonlySet<number> | null;
  layers: MapLayers;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const compactRef = useRef(false);
  const markers = useRef<
    Map<number, { marker: Marker; el: HTMLButtonElement; wrap: HTMLDivElement }>
  >(new Map());
  const cabinetMarkers = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fitted = useRef(false);

  // Mapa y pines (se crean una sola vez por conjunto de parcelas).
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl(workerUrl);
      if (cancelled || !container.current) {
        return;
      }
      const map = new maplibre.Map({
        attributionControl: { compact: true },
        center: DEFAULT_CENTER,
        container: container.current,
        maxBounds: REGION_BOUNDS,
        minZoom: MIN_ZOOM,
        style: {
          layers: [{ id: "osm", source: "osm", type: "raster" }],
          sources: {
            osm: {
              attribution: "© OpenStreetMap",
              maxzoom: 18,
              tileSize: 256,
              tiles: [TILE_URL],
              type: "raster",
            },
          },
          version: 8,
        },
        zoom: DEFAULT_ZOOM,
      });
      mapRef.current = map;
      const syncCompact = () => {
        const compact = map.getZoom() < COMPACT_ZOOM;
        compactRef.current = compact;
        container.current?.classList.toggle("pins-compact", compact);
      };
      syncCompact();
      map.on("zoom", syncCompact);
      for (const plot of plots) {
        if (plot.lat === null || plot.lon === null) {
          continue;
        }
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pin";
        el.textContent = String(plot.number);
        el.setAttribute(
          "aria-label",
          `Parcela ${plot.number} · ${plot.sector}`
        );
        el.title = `Parcela ${plot.number} · ${plot.sector}`;
        el.addEventListener("click", () => onSelectRef.current(plot.number));
        // MapLibre posiciona el elemento del marcador con su propio transform: el botón va dentro de un contenedor.
        const wrap = document.createElement("div");
        wrap.append(el);
        const marker = new maplibre.Marker({ element: wrap })
          .setLngLat([plot.lon, plot.lat])
          .addTo(map);
        markers.current.set(plot.number, { el, marker, wrap });
      }
      for (const plot of plots) {
        if (plot.cabE === null || plot.cabN === null) {
          continue;
        }
        const { lat, lon } = utmToLatLon(plot.cabE, plot.cabN);
        const wrap = document.createElement("div");
        wrap.setAttribute("aria-hidden", "true");
        wrap.style.display = "none";
        const diamond = document.createElement("span");
        diamond.style.cssText =
          "display:block;width:10px;height:10px;transform:rotate(45deg);background:#fff;border:2px solid #1B1B18";
        wrap.append(diamond);
        cabinetMarkers.current.push(
          new maplibre.Marker({ element: wrap })
            .setLngLat([lon, lat])
            .addTo(map)
        );
      }
      map.on("load", async () => {
        try {
          const res = await fetch("/geo/anp.geojson", { method: "HEAD" });
          if (res.ok && res.headers.get("content-type")?.includes("json")) {
            const source: GeoJSONSourceSpecification = {
              data: "/geo/anp.geojson",
              type: "geojson",
            };
            map.addSource(ANP_SOURCE, source);
            map.addLayer({
              id: "anp-fill",
              layout: { visibility: "none" },
              paint: { "fill-color": "#4E9A68", "fill-opacity": 0.15 },
              source: ANP_SOURCE,
              type: "fill",
            });
            map.addLayer({
              id: "anp-line",
              layout: { visibility: "none" },
              paint: {
                "line-color": "#1B1B18",
                "line-dasharray": [2, 2],
                "line-width": 2,
              },
              source: ANP_SOURCE,
              type: "line",
            });
          }
        } catch {
          // Sin archivo de límites: la capa simplemente no existe.
        }
      });
    }
    setup();
    return () => {
      cancelled = true;
      markers.current.clear();
      cabinetMarkers.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      fitted.current = false;
    };
  }, [plots]);

  // Estilo de cada pin según selección, búsqueda y modo de color.
  useEffect(() => {
    for (const plot of plots) {
      const entry = markers.current.get(plot.number);
      if (!entry) {
        continue;
      }
      const dimmed = matching !== null && !matching.has(plot.number);
      entry.el.style.cssText = pinStyle(
        plot,
        plot.number === selected,
        dimmed,
        layers.strata
      );
      entry.wrap.style.display = layers.plots ? "" : "none";
      entry.wrap.style.zIndex = plot.number === selected ? "5" : "1";
    }
  });

  useEffect(() => {
    for (const marker of cabinetMarkers.current) {
      marker.getElement().style.display = layers.cabinet ? "block" : "none";
    }
    const map = mapRef.current;
    for (const id of ["anp-fill", "anp-line"]) {
      if (map?.getLayer(id)) {
        map.setLayoutProperty(
          id,
          "visibility",
          layers.anp ? "visible" : "none"
        );
      }
    }
  }, [layers.cabinet, layers.anp]);

  // Al elegir una parcela, el mapa la acerca al centro sin cambiar el zoom.
  useEffect(() => {
    const map = mapRef.current;
    const plot = plots.find((p) => p.number === selected);
    if (!(map && plot) || plot.lat === null || plot.lon === null) {
      return;
    }
    map.easeTo({ center: [plot.lon, plot.lat], duration: 250 });
  }, [selected, plots]);

  // Encuadre inicial y al buscar.
  useEffect(() => {
    const map = mapRef.current;
    // biome-ignore lint/suspicious/noUnnecessaryConditions: valor mutable en tiempo de ejecución (ref o dato externo)
    if (!map) {
      return;
    }
    const pts = plots.filter(
      (p) =>
        p.lat !== null &&
        p.lon !== null &&
        (matching === null || matching.has(p.number))
    );
    // biome-ignore lint/suspicious/noUnnecessaryConditions: valor mutable en tiempo de ejecución (ref o dato externo)
    if (pts.length === 0 || (fitted.current && matching === null)) {
      return;
    }
    fitted.current = true;
    const lons = pts.map((p) => p.lon as number);
    const lats = pts.map((p) => p.lat as number);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { duration: 400, maxZoom: FOCUS_ZOOM, padding: FIT_PADDING }
    );
  }, [plots, matching]);

  function fitAll() {
    const map = mapRef.current;
    const pts = plots.filter((p) => p.lat !== null && p.lon !== null);
    if (!map || pts.length === 0) {
      return;
    }
    const lons = pts.map((p) => p.lon as number);
    const lats = pts.map((p) => p.lat as number);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { duration: 400, maxZoom: FOCUS_ZOOM, padding: FIT_PADDING }
    );
  }

  return (
    <div className="relative size-full">
      <div className="size-full" ref={container} />
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <Button
          aria-label="Acercar"
          className="!px-0 size-11"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Plus aria-hidden="true" size={20} />
        </Button>
        <Button
          aria-label="Alejar"
          className="!px-0 size-11"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Minus aria-hidden="true" size={20} />
        </Button>
        <Button
          aria-label="Ver todas las parcelas"
          className="!px-0 size-11"
          onClick={fitAll}
          title="Ver todas las parcelas"
        >
          <Maximize aria-hidden="true" size={18} />
        </Button>
      </div>
    </div>
  );
}
