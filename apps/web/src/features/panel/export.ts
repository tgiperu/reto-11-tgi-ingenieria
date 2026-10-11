import {
  REVIEW_LABELS,
  type ReviewState,
} from "@reto-11-tgi-ingenieria/domain/constants";
import { todayLima } from "@/lib/dates";
import { fmtDateTime, fmtNum } from "@/lib/format";
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
  rowsAlt: number;
  rowsDap: number;
  species: number;
}

const RANGE_SEPARATOR = "–";

export async function exportOutliers(
  data: ExportData,
  speciesFilter: string | null,
  variable: "all" | "dap" | "alt"
): Promise<ExportSummary> {
  const state = (r: string) => REVIEW_LABELS[r as ReviewState] ?? r;
  const dapRows = data.outliers
    .filter((o) => o.isDap && variable !== "alt")
    .map((o) => {
      const sd = o.dapSd && o.dapSd > 0 ? o.dapSd : null;
      const deviation =
        sd && o.dapEq !== null && o.dapMean !== null
          ? (o.dapEq - o.dapMean) / sd
          : null;
      return [
        fmtDateTime(o.measuredAt),
        `P-${o.plot}`,
        o.code,
        o.species ?? "",
        o.dapEq === null ? "" : Number(o.dapEq.toFixed(2)),
        `${fmtNum(o.dapMin)}${RANGE_SEPARATOR}${fmtNum(o.dapMax)}`,
        deviation === null ? "" : Number(deviation.toFixed(2)),
        state(o.review),
        o.brigade ?? "",
      ];
    });
  const altRows = data.outliers
    .filter((o) => o.isAlt && variable !== "dap")
    .map((o) => [
      fmtDateTime(o.measuredAt),
      `P-${o.plot}`,
      o.code,
      o.species ?? "",
      o.height === null ? "" : Number(o.height.toFixed(2)),
      `1.5${RANGE_SEPARATOR}${fmtNum(o.heightMax)}`,
      o.height !== null && o.heightMax !== null
        ? Number((o.height - o.heightMax).toFixed(2))
        : "",
      state(o.review),
      o.brigade ?? "",
    ]);
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
  const dapSheet: SheetData = {
    headers: [
      "Fecha",
      "Parcela",
      "N°",
      "Especie",
      "DAP (cm)",
      "Rango esperado (cm)",
      "Desvío (DE)",
      "Estado",
      "Brigada",
    ],
    name: "Atípicos DAP",
    rows: dapRows,
  };
  const altSheet: SheetData = {
    headers: [
      "Fecha",
      "Parcela",
      "N°",
      "Especie",
      "Altura (m)",
      "Rango esperado (m)",
      "Sobre el máx. (m)",
      "Estado",
      "Brigada",
    ],
    name: "Atípicos altura",
    rows: altRows,
  };
  const slug = speciesFilter ? `${speciesFilter.replace(/\s+/g, "-")}_` : "";
  const fileName = `validacion_atipicos_${slug}${todayLima()}.xlsx`;
  await downloadWorkbook(fileName, [summary, dapSheet, altSheet]);
  return {
    fileName,
    rowsAlt: altRows.length,
    rowsDap: dapRows.length,
    species: data.species.length,
  };
}
