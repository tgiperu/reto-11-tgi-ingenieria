import { z } from "zod";

import { CATEGORY_KEYS, type CategoryKey, type CodeSeries } from "./categories";
import type { PlotStatus, Role } from "./constants";
import type { RuleSetting } from "./rules";

const MAX_STEMS = 40;
const MAX_NOTES = 2000;

export const photoSchema = z.object({
  /** Contenido en base64, sin el prefijo `data:`. */
  data: z.string().max(2_500_000),
  mime: z.string().max(40),
});
export type PhotoPayload = z.infer<typeof photoSchema>;

export const pushRecordSchema = z.object({
  accuracy: z.number().nonnegative().nullable(),
  category: z.enum(CATEGORY_KEYS),
  clientId: z.string().uuid(),
  clino: z
    .object({ distance: z.number(), pctBase: z.number(), pctTop: z.number() })
    .nullable(),
  code: z.string().regex(/^\d{1,6}$/),
  crownMax: z.number().nonnegative().nullable(),
  crownMin: z.number().nonnegative().nullable(),
  dac1: z.number().nonnegative().nullable(),
  dac2: z.number().nonnegative().nullable(),
  height: z.number().nonnegative().max(80).nullable(),
  heightMode: z.enum(["direct", "clino"]),
  isRemeasure: z.boolean(),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  measuredAt: z.string().datetime(),
  notes: z.string().max(MAX_NOTES),
  photo: photoSchema.nullable(),
  plotNumber: z.number().int().positive(),
  speciesId: z.number().int().nullable(),
  stems: z.array(z.number().positive().max(500)).max(MAX_STEMS),
});
export type PushRecord = z.infer<typeof pushRecordSchema>;

export const pushInputSchema = z.object({
  records: z.array(pushRecordSchema).min(1).max(50),
});

export type PushResultStatus = "saved" | "already" | "rejected";
export interface PushResult {
  clientId: string;
  message?: string;
  status: PushResultStatus;
}

export interface PullPlot {
  /** Ya enviada y bloqueada: ya no se puede registrar en ella. */
  closed: boolean;
  lat: number | null;
  lon: number | null;
  number: number;
  sector: string;
  status: PlotStatus;
  stratum: string;
}

export interface PullSpecies {
  count: number;
  dapMax: number | null;
  hMax: number | null;
  id: number;
  isNN: boolean;
  name: string;
  scientificName: string | null;
}

export interface PullTree {
  category: CategoryKey;
  code: string;
  dapEq: number | null;
  height: number | null;
  measuredAt: string;
  plot: number;
  series: CodeSeries;
  speciesId: number | null;
  speciesName: string | null;
}

export interface PullBundle {
  catalogVersion: number;
  plots: PullPlot[];
  rules: RuleSetting[];
  rulesVersion: string;
  serverTime: string;
  species: PullSpecies[];
  trees: PullTree[];
  user: {
    id: string;
    name: string;
    role: Role;
    brigadeId: string | null;
    brigadeName: string | null;
  };
}
