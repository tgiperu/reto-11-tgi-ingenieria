import { todayLima } from "@/lib/dates";
import { downloadWorkbook, type SheetData } from "@/lib/xlsx";

export interface ExportData {
  outliers: {
    brigade: string | null;
    code: string;
    dapEq: number | null;
    dapMax: number | null;
    dapMean: number | null;
    dapMin: number | null;
    dapSd: number | null;
    height: number | null;
    heightMax: number | null;
    isAlt: boolean;
    isDap: boolean;
    measuredAt: string;
    plot: number;
    review: string;
    species: string | null;
  }[];
  plots: {
    aerial: number;
    number: number;
    root: number;
    stratum: string;
    total: number;
  }[];
  species: {
    id: number;
    name: string;
    n: number;
    dapMean: number | null;
    dapSd: number | null;
    dapMin: number | null;
    dapMax: number | null;
    heightMean: number | null;
    heightMax: number | null;
    dapOut: number;
    altOut: number;
  }[];
}

export interface ExportSummary {
  fileName: string;
  plots: number;
  species: number;
}

export async function exportOutliers(
  data: ExportData,
  speciesFilter: string | null
): Promise<ExportSummary> {
  const summary: SheetData = {
    headers: [
      "Especie",
      "Mediciones",
      "DAP medio (cm)",
      "DE",
      "Límite DAP (cm)",
      "Atípicos DAP",
      "Altura máx. (m)",
      "Atípicas altura",
    ],
    name: "Resumen por especie",
    rows: data.species.map((s) => [
      s.name,
      s.n,
      s.dapMean === null ? "" : Number(s.dapMean.toFixed(2)),
      s.dapSd === null ? "" : Number(s.dapSd.toFixed(2)),
      s.dapMax ?? "",
      s.dapOut,
      s.heightMax ?? "",
      s.altOut,
    ]),
  };
  const round2 = (v: number) => Number(v.toFixed(2));
  const carbonSheet: SheetData = {
    headers: [
      "Parcela",
      "Suma de Reservorio aereo (tC/ha)",
      "Suma de Reservorio subterraneo (tC/ha)",
      "Suma de Reservorio total (tC/ha)",
      "Estrato",
    ],
    name: "Carbono x parcela",
    rows: data.plots.map((p) => [
      p.number,
      round2(p.aerial),
      round2(p.root),
      round2(p.total),
      p.stratum,
    ]),
    table: {
      total: {
        column: 4,
        value: round2(data.plots.reduce((sum, p) => sum + p.total, 0)),
      },
    },
  };
  const slug = speciesFilter ? `${speciesFilter.replace(/\s+/g, "-")}_` : "";
  const fileName = `validacion_atipicos_${slug}${todayLima()}.xlsx`;
  await downloadWorkbook(fileName, [summary, carbonSheet]);
  return {
    fileName,
    plots: data.plots.length,
    species: data.species.length,
  };
}
