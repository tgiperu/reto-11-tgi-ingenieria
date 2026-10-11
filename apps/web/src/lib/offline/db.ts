import type {
  CategoryKey,
  CodeSeries,
} from "@reto-11-tgi-ingenieria/domain/categories";
import type { HealthKey } from "@reto-11-tgi-ingenieria/domain/health";
import type { RuleSetting } from "@reto-11-tgi-ingenieria/domain/rules";
import type {
  PullPlot,
  PullSpecies,
} from "@reto-11-tgi-ingenieria/domain/sync";
import Dexie, { type Table } from "dexie";

/** 0 = por enviar · 1 = enviado y bloqueado · 2 = rechazado por el servidor */
export type SentState = 0 | 1 | 2;

export interface LocalRecord {
  accuracy: number | null;
  alertTitles: string[];
  category: CategoryKey;
  clientId: string;
  clino: { distance: number; pctBase: number; pctTop: number } | null;
  code: string;
  createdAt: number;
  crownMax: number | null;
  crownMin: number | null;
  dac1: number | null;
  dac2: number | null;
  dapEq: number | null;
  error: string | null;
  /** Registros guardados antes de existir el campo no lo traen. */
  health?: HealthKey | null;
  height: number | null;
  heightMode: "direct" | "clino";
  isRemeasure: boolean;
  lat: number | null;
  lon: number | null;
  measuredAt: string;
  notes: string;
  photo: Blob | null;
  plotNumber: number;
  sent: SentState;
  speciesId: number | null;
  speciesName: string;
  stems: number[];
}

export type LocalPlot = PullPlot;

export interface LocalTree {
  category: CategoryKey;
  code: string;
  dapEq: number | null;
  height: number | null;
  key: string;
  /** Creado en este equipo y aún no confirmado por el servidor. */
  local: boolean;
  measuredAt: string;
  plot: number;
  series: CodeSeries;
  speciesId: number | null;
  speciesName: string | null;
}

export interface BundleMeta {
  catalogVersion: number;
  downloadedAt: number;
  rules: RuleSetting[];
  rulesVersion: string;
  serverTime: string;
  user: {
    id: string;
    name: string;
    brigadeId: string | null;
    brigadeName: string | null;
  };
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class CampoDb extends Dexie {
  records!: Table<LocalRecord, string>;
  plots!: Table<LocalPlot, number>;
  species!: Table<PullSpecies, number>;
  trees!: Table<LocalTree, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("inventario-campo");
    this.version(1).stores({
      meta: "key",
      plots: "number",
      records: "clientId, plotNumber, sent, createdAt",
      species: "id",
      trees: "key, plot",
    });
  }
}

export const campoDb = new CampoDb();

export function treeKey(
  plot: number,
  series: CodeSeries,
  code: string
): string {
  return `${plot}|${series}|${code}`;
}

export async function getBundleMeta(): Promise<BundleMeta | null> {
  const row = await campoDb.meta.get("bundle");
  return (row?.value as BundleMeta | undefined) ?? null;
}
