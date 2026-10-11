import type { Database } from "@reto-11-tgi-ingenieria/db";
import { species } from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  carbonOf,
  type EquationKey,
  type Equations,
} from "@reto-11-tgi-ingenieria/domain/carbon";
import type { CategoryKey } from "@reto-11-tgi-ingenieria/domain/categories";
import type { ReviewState } from "@reto-11-tgi-ingenieria/domain/constants";
import {
  type EvalPrevious,
  evaluateMeasurement,
  type RuleAlert,
  type RuleSetting,
} from "@reto-11-tgi-ingenieria/domain/rules";
import { sql } from "drizzle-orm";

export type SpeciesRow = typeof species.$inferSelect;

export type SpeciesMap = Map<number, SpeciesRow>;

export async function loadSpecies(db: Database): Promise<SpeciesMap> {
  const rows = await db.select().from(species);
  return new Map(rows.map((r) => [r.id, r]));
}

/** Reglas que dependen del contexto del registro y no se pueden recalcular desde la fila sola. */
export const CONTEXT_RULES: readonly string[] = [
  "sp_prev",
  "dap_prev",
  "gps",
  "dup",
];

export interface MeasuredFields {
  category: CategoryKey;
  codeLabel: string;
  crownAvg: number | null;
  dacAvg: number | null;
  dapEq: number | null;
  height: number | null;
  notes: string;
  photoCount: number;
  speciesId: number | null;
}

export interface EvaluationContext {
  equations: Equations;
  rules: readonly RuleSetting[];
  species: SpeciesMap;
}

export interface EvaluationExtras {
  duplicate?: boolean;
  gpsDistanceM?: number | null;
  previous?: EvalPrevious | null;
}

export function evaluateFields(
  fields: MeasuredFields,
  ctx: EvaluationContext,
  extras: EvaluationExtras = {}
): {
  alerts: RuleAlert[];
  carbon: { aerial: number; root: number; total: number };
} {
  const sp =
    fields.speciesId === null ? undefined : ctx.species.get(fields.speciesId);
  const alerts = evaluateMeasurement(
    {
      category: fields.category,
      codeLabel: fields.codeLabel,
      crownAvg: fields.crownAvg,
      dacAvg: fields.dacAvg,
      dapEq: fields.dapEq,
      duplicate: extras.duplicate ?? false,
      gpsDistanceM: extras.gpsDistanceM ?? null,
      height: fields.height,
      notes: fields.notes,
      photoCount: fields.photoCount,
      previous: extras.previous ?? null,
      species: sp
        ? {
            dapMax: sp.dapMax,
            hMax: sp.heightMax,
            id: sp.id,
            isNN: sp.isNN,
            name: sp.name,
          }
        : null,
    },
    ctx.rules
  );
  const carbon = carbonOf(
    {
      category: fields.category,
      crownAvg: fields.crownAvg,
      dacAvg: fields.dacAvg,
      dapEq: fields.dapEq,
      equationKey: (sp?.equationKey ?? null) as EquationKey,
    },
    ctx.equations
  );
  return { alerts, carbon };
}

/** Estado de revisión inicial de una medición según sus alertas y si trae foto de respaldo. */
export function initialReview(
  alerts: readonly RuleAlert[],
  hasPhoto: boolean
): ReviewState {
  if (alerts.length === 0) {
    return "none";
  }
  return hasPhoto ? "justified" : "pending";
}

/** Al reevaluar: conserva las decisiones del supervisor (aceptada / re-medición). */
export function nextReview(
  current: ReviewState,
  alerts: readonly RuleAlert[],
  hasPhoto: boolean
): ReviewState {
  if (current === "accepted" || current === "remeasure") {
    return current;
  }
  return initialReview(alerts, hasPhoto);
}

export interface MeasurementUpdate {
  alerts: RuleAlert[];
  carbon: { aerial: number; root: number; total: number };
  id: string;
  review: ReviewState;
}

const UPDATE_CHUNK = 400;

/** UPDATE masivo con VALUES: una sola ida y vuelta por cada 400 filas. */
export async function bulkUpdateMeasurements(
  db: Database,
  updates: readonly MeasurementUpdate[]
): Promise<void> {
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const slice = updates.slice(i, i + UPDATE_CHUNK);
    const values = sql.join(
      slice.map(
        (u) =>
          sql`(${u.id}::uuid, ${JSON.stringify(u.alerts)}::jsonb, ${u.review}::text, ${u.carbon.aerial}::double precision, ${u.carbon.root}::double precision, ${u.carbon.total}::double precision)`
      ),
      sql`, `
    );
    // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
    await db.execute(sql`
      UPDATE measurement AS m SET
        alerts = v.alerts,
        review = v.review,
        carbon_aerial = v.ca,
        carbon_root = v.cr,
        carbon_total = v.ct
      FROM (VALUES ${values}) AS v(id, alerts, review, ca, cr, ct)
      WHERE m.id = v.id
    `);
  }
}

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type ReevalRow = {
  alerts: RuleAlert[];
  category: string;
  code: string;
  crown_max: number | null;
  crown_min: number | null;
  dac1: number | null;
  dac2: number | null;
  dap_eq: number | null;
  has_photo: boolean;
  height: number | null;
  id: string;
  notes: string;
  review: string;
  species_id: number | null;
};

/**
 * Recalcula alertas y carbono de las mediciones que cumplan `where` (SQL sobre `m`, alias de measurement).
 * Conserva las alertas que dependen del contexto del registro (código duplicado, remedición, GPS).
 */
export async function reevaluateMeasurements(
  db: Database,
  ctx: EvaluationContext,
  where: ReturnType<typeof sql>
): Promise<number> {
  const result = await db.execute<ReevalRow>(sql`
    SELECT m.id, m.category, m.species_id, m.dap_eq, m.crown_min, m.crown_max, m.dac1, m.dac2,
           m.height, m.notes, m.has_photo, m.review, m.alerts, t.code
    FROM measurement m JOIN tree t ON t.id = m.tree_id
    WHERE ${where}
  `);
  const updates: MeasurementUpdate[] = result.rows.map((row) => {
    const crownAvg =
      row.crown_min !== null && row.crown_max !== null
        ? (row.crown_min + row.crown_max) / 2
        : (row.crown_min ?? row.crown_max);
    const dacAvg =
      row.dac1 !== null && row.dac2 !== null
        ? (row.dac1 + row.dac2) / 2
        : (row.dac1 ?? row.dac2);
    const { alerts, carbon } = evaluateFields(
      {
        category: row.category as CategoryKey,
        codeLabel: row.code,
        crownAvg,
        dacAvg,
        dapEq: row.dap_eq,
        height: row.height,
        notes: row.notes,
        photoCount: row.has_photo ? 1 : 0,
        speciesId: row.species_id,
      },
      ctx
    );
    const kept = row.alerts.filter((a) => CONTEXT_RULES.includes(a.rule));
    const merged = [
      ...alerts.filter((a) => !CONTEXT_RULES.includes(a.rule)),
      ...kept,
    ];
    return {
      alerts: merged,
      carbon,
      id: row.id,
      review: nextReview(row.review as ReviewState, merged, row.has_photo),
    };
  });
  await bulkUpdateMeasurements(db, updates);
  return updates.length;
}

/**
 * Estadísticas por especie a partir de las mediciones y límites de alerta (media + k·DE).
 * No toca las especies con límites fijados a mano.
 */
export async function recomputeSpeciesStats(
  db: Database,
  k: number
): Promise<void> {
  await db.execute(sql`
    WITH s AS (
      SELECT species_id,
             count(dap_eq) AS n,
             avg(dap_eq) AS dap_mean,
             stddev_samp(dap_eq) AS dap_sd,
             count(height) AS hn,
             avg(height) AS h_mean,
             stddev_samp(height) AS h_sd
      FROM measurement
      WHERE species_id IS NOT NULL
      GROUP BY species_id
    )
    UPDATE species sp SET
      dap_mean = s.dap_mean,
      dap_sd = s.dap_sd,
      height_mean = s.h_mean,
      sample_size = s.n,
      dap_max = CASE
        WHEN sp.limits_manual OR s.n < 5 OR s.dap_sd IS NULL THEN sp.dap_max
        ELSE round((s.dap_mean + ${k} * s.dap_sd)::numeric, 1)
      END,
      height_max = CASE
        WHEN sp.limits_manual OR s.hn < 5 OR s.h_sd IS NULL THEN sp.height_max
        ELSE round((s.h_mean + ${k} * s.h_sd)::numeric, 1)
      END,
      updated_at = now()
    FROM s WHERE sp.id = s.species_id
  `);
}

/** Recalcula el estado de las parcelas dadas según sus alertas abiertas. */
export async function refreshPlotStatuses(
  db: Database,
  plotNumbers: readonly number[] | null,
  cleanStatus: "review" | "locked"
): Promise<void> {
  const scope = plotNumbers
    ? sql`AND p.number IN (${sql.join(
        plotNumbers.map((n) => sql`${n}`),
        sql`, `
      )})`
    : sql``;
  if (plotNumbers && plotNumbers.length === 0) {
    return;
  }
  await db.execute(sql`
    UPDATE plot p SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM measurement m
        WHERE m.plot_number = p.number AND m.review IN ('pending', 'justified')
      ) THEN 'alert'
      ELSE ${cleanStatus}
    END
    WHERE p.status IN ('assigned', 'review', 'alert')
      AND EXISTS (SELECT 1 FROM measurement m WHERE m.plot_number = p.number)
      ${scope}
  `);
}
