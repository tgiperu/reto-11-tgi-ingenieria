import { measurement, tree } from "@reto-11-tgi-ingenieria/db/schema/inventory";
import { ANPS, STRATA } from "@reto-11-tgi-ingenieria/domain/constants";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { router, staffProcedure } from "../index";
import { writeAudit } from "../lib/audit";
import { refreshPlotStatuses } from "../lib/evaluation";

const LIMA_TZ = "America/Lima";
const DAY_MS = 86_400_000;
const FEED_LIMIT = 10;
const SPECIES_ROWS = 8;
const DOTS_PER_SPECIES = 14;
const WEEK_DAYS = 7;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const filtersSchema = z.object({
  anp: z.enum(["all", ...ANPS]).default("all"),
  period: z
    .object({
      from: z.string().regex(ISO_DAY).optional(),
      kind: z.enum(["all", "today", "week", "custom"]),
      to: z.string().regex(ISO_DAY).optional(),
    })
    .default({ kind: "all" }),
  speciesId: z.number().int().nullable().default(null),
  status: z.enum(["all", "open", "done"]).default("all"),
  stratum: z.enum(["all", ...STRATA]).default("all"),
  variable: z.enum(["all", "dap", "alt"]).default("all"),
});
export type DashboardFilters = z.infer<typeof filtersSchema>;

function limaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LIMA_TZ }).format(
    new Date()
  );
}

function shiftDay(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Condiciones SQL sobre los alias `m` (measurement) y `p` (plot). */
export function filterWhere(f: DashboardFilters, withSpecies: boolean) {
  const parts = [sql`true`];
  if (f.anp !== "all") {
    parts.push(sql`p.anp = ${f.anp}`);
  }
  if (f.stratum !== "all") {
    parts.push(sql`p.stratum = ${f.stratum}`);
  }
  const today = limaToday();
  const day = sql`(m.measured_at AT TIME ZONE 'America/Lima')::date`;
  if (f.period.kind === "today") {
    parts.push(sql`${day} = ${today}::date`);
  } else if (f.period.kind === "week") {
    parts.push(
      sql`${day} BETWEEN ${shiftDay(today, 1 - WEEK_DAYS)}::date AND ${today}::date`
    );
  } else if (f.period.kind === "custom" && f.period.from && f.period.to) {
    parts.push(
      sql`${day} BETWEEN ${f.period.from}::date AND ${f.period.to}::date`
    );
  }
  if (withSpecies && f.speciesId !== null) {
    parts.push(sql`m.species_id = ${f.speciesId}`);
  }
  return sql.join(parts, sql` AND `);
}

const DAP_OUT = sql`m.alerts @> '[{"rule":"dap"}]'::jsonb`;
const ALT_OUT = sql`m.alerts @> '[{"rule":"alt"}]'::jsonb`;
const OPEN = sql`m.review IN ('pending', 'justified')`;

function statusCondition(status: DashboardFilters["status"]) {
  if (status === "open") {
    return sql` AND ${OPEN}`;
  }
  if (status === "done") {
    return sql` AND NOT (${OPEN})`;
  }
  return sql``;
}

function variableCondition(variable: DashboardFilters["variable"]) {
  if (variable === "dap") {
    return DAP_OUT;
  }
  if (variable === "alt") {
    return ALT_OUT;
  }
  return sql`(${DAP_OUT} OR ${ALT_OUT})`;
}

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type Kpis = {
  alerts_total: number;
  alt_out: number;
  dap_out: number;
  last_sync: string | null;
  pending: number;
  total: number;
  validated: number;
};

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type SpeciesAgg = {
  alt_out: number;
  dap_max: number | null;
  dap_mean: number | null;
  dap_min: number | null;
  dap_out: number;
  dap_sd: number | null;
  height_max: number | null;
  height_mean: number | null;
  id: number;
  n: number;
  name: string;
};

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type FeedRow = {
  code: string;
  dap_eq: number | null;
  dap_max: number | null;
  dap_mean: number | null;
  dap_min: number | null;
  dap_sd: number | null;
  height: number | null;
  height_max: number | null;
  id: string;
  is_alt: boolean;
  is_dap: boolean;
  measured_at: string;
  plot_number: number;
  review: string;
  species_id: number | null;
  species_name: string | null;
  synced_at: string;
};

export const dashboardRouter = router({
  /** Número de alertas abiertas: es el contador de la barra lateral. */
  badge: staffProcedure.query(async ({ ctx }) => {
    const [row] = (
      await ctx.db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM measurement m WHERE jsonb_array_length(m.alerts) > 0
      `)
    ).rows;
    const [last] = (
      await ctx.db.execute<{ at: string | null }>(
        sql`SELECT max(synced_at) AS at FROM measurement`
      )
    ).rows;
    return {
      alerts: row?.n ?? 0,
      lastSync: last?.at ? new Date(last.at).toISOString() : null,
    };
  }),
  export: staffProcedure.input(filtersSchema).query(async ({ ctx, input }) => {
    const where = filterWhere(input, true);
    const species = await ctx.db.execute<SpeciesAgg>(sql`
      SELECT sp.id, sp.name, sp.dap_mean, sp.dap_sd, sp.dap_min, sp.dap_max, sp.height_mean, sp.height_max,
             count(m.id)::int AS n,
             count(*) FILTER (WHERE ${DAP_OUT})::int AS dap_out,
             count(*) FILTER (WHERE ${ALT_OUT})::int AS alt_out
      FROM measurement m JOIN plot p ON p.number = m.plot_number
      JOIN species sp ON sp.id = m.species_id
      WHERE ${where}
      GROUP BY sp.id ORDER BY n DESC
    `);
    const rows = await ctx.db.execute<
      FeedRow & { brigade_id: string | null; leader: string | null }
    >(sql`
      SELECT m.id, m.measured_at, m.synced_at, m.plot_number, t.code, m.species_id, sp.name AS species_name,
             sp.dap_mean, sp.dap_sd, sp.dap_min, sp.dap_max, sp.height_max, m.dap_eq, m.height, m.review,
             ${DAP_OUT} AS is_dap, ${ALT_OUT} AS is_alt, p.brigade_id, b.leader_name AS leader
      FROM measurement m JOIN plot p ON p.number = m.plot_number
      JOIN tree t ON t.id = m.tree_id
      LEFT JOIN species sp ON sp.id = m.species_id
      LEFT JOIN brigade b ON b.id = p.brigade_id
      WHERE ${where} AND ${variableCondition(input.variable)}
      ORDER BY m.measured_at DESC
    `);
    return {
      outliers: rows.rows.map((r) => ({
        brigade: r.leader ?? r.brigade_id,
        code: r.code,
        dapEq: r.dap_eq,
        dapMax: r.dap_max,
        dapMean: r.dap_mean,
        dapMin: r.dap_min,
        dapSd: r.dap_sd,
        height: r.height,
        heightMax: r.height_max,
        isAlt: r.is_alt,
        isDap: r.is_dap,
        measuredAt: new Date(r.measured_at).toISOString(),
        plot: r.plot_number,
        review: r.review,
        species: r.species_name,
      })),
      species: species.rows.map((s) => ({
        altOut: s.alt_out,
        dapMax: s.dap_max,
        dapMean: s.dap_mean,
        dapMin: s.dap_min,
        dapOut: s.dap_out,
        dapSd: s.dap_sd,
        heightMax: s.height_max,
        heightMean: s.height_mean,
        id: s.id,
        n: s.n,
        name: s.name,
      })),
    };
  }),

  overview: staffProcedure
    .input(filtersSchema)
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const where = filterWhere(input, true);
      const whereAllSpecies = filterWhere(input, false);

      const [kpis] = (
        await db.execute<Kpis>(sql`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE m.review IN ('none', 'accepted'))::int AS validated,
               count(*) FILTER (WHERE ${DAP_OUT})::int AS dap_out,
               count(*) FILTER (WHERE ${ALT_OUT})::int AS alt_out,
               count(*) FILTER (WHERE ${OPEN})::int AS pending,
               count(*) FILTER (WHERE jsonb_array_length(m.alerts) > 0)::int AS alerts_total,
               max(m.synced_at) AS last_sync
        FROM measurement m JOIN plot p ON p.number = m.plot_number
        WHERE ${where}
      `)
      ).rows;

      const speciesRows = (
        await db.execute<SpeciesAgg>(sql`
        SELECT sp.id, sp.name, sp.dap_mean, sp.dap_sd, sp.dap_min, sp.dap_max, sp.height_mean, sp.height_max,
               count(m.id)::int AS n,
               count(*) FILTER (WHERE ${DAP_OUT})::int AS dap_out,
               count(*) FILTER (WHERE ${ALT_OUT})::int AS alt_out
        FROM measurement m JOIN plot p ON p.number = m.plot_number
        JOIN species sp ON sp.id = m.species_id
        WHERE ${whereAllSpecies}
        GROUP BY sp.id ORDER BY n DESC LIMIT ${SPECIES_ROWS}
      `)
      ).rows;

      const dotsBySpecies = new Map<number, { dap: number[]; alt: number[] }>();
      if (speciesRows.length > 0) {
        const ids = sql.join(
          speciesRows.map((s) => sql`${s.id}`),
          sql`, `
        );
        const dots = await db.execute<{
          species_id: number;
          dap_eq: number | null;
          height: number | null;
          is_dap: boolean;
          is_alt: boolean;
        }>(sql`
        SELECT m.species_id, m.dap_eq, m.height, ${DAP_OUT} AS is_dap, ${ALT_OUT} AS is_alt
        FROM measurement m JOIN plot p ON p.number = m.plot_number
        WHERE ${whereAllSpecies} AND m.species_id IN (${ids}) AND (${DAP_OUT} OR ${ALT_OUT})
        ORDER BY m.measured_at DESC LIMIT 600
      `);
        for (const d of dots.rows) {
          const entry = dotsBySpecies.get(d.species_id) ?? { alt: [], dap: [] };
          if (
            d.is_dap &&
            d.dap_eq !== null &&
            entry.dap.length < DOTS_PER_SPECIES
          ) {
            entry.dap.push(d.dap_eq);
          }
          if (
            d.is_alt &&
            d.height !== null &&
            entry.alt.length < DOTS_PER_SPECIES
          ) {
            entry.alt.push(d.height);
          }
          dotsBySpecies.set(d.species_id, entry);
        }
      }

      const feedWhere = sql`${where} AND ${variableCondition(input.variable)}`;
      const counts = (
        await db.execute<{ all_n: number; open_n: number }>(sql`
        SELECT count(*)::int AS all_n, count(*) FILTER (WHERE ${OPEN})::int AS open_n
        FROM measurement m JOIN plot p ON p.number = m.plot_number
        WHERE ${feedWhere}
      `)
      ).rows[0] ?? { all_n: 0, open_n: 0 };
      const statusCond = statusCondition(input.status);
      const feedRows = (
        await db.execute<FeedRow>(sql`
        SELECT m.id, m.measured_at, m.synced_at, m.plot_number, t.code, m.species_id, sp.name AS species_name,
               sp.dap_mean, sp.dap_sd, sp.dap_min, sp.dap_max, sp.height_max, m.dap_eq, m.height, m.review,
               ${DAP_OUT} AS is_dap, ${ALT_OUT} AS is_alt
        FROM measurement m JOIN plot p ON p.number = m.plot_number
        JOIN tree t ON t.id = m.tree_id
        LEFT JOIN species sp ON sp.id = m.species_id
        WHERE ${feedWhere}${statusCond}
        ORDER BY m.synced_at DESC, m.measured_at DESC LIMIT ${FEED_LIMIT}
      `)
      ).rows;

      const feed = feedRows.flatMap((r) => {
        const items: {
          id: string;
          measurementId: string;
          syncedAt: string;
          plot: number;
          code: string;
          species: string;
          variable: "dap" | "alt";
          value: number;
          lo: number;
          hi: number;
          deviation: number;
          strong: boolean;
          review: string;
        }[] = [];
        const base = {
          code: r.code,
          measurementId: r.id,
          plot: r.plot_number,
          review: r.review,
          species: r.species_name ?? "Sin especie",
          syncedAt: new Date(r.synced_at).toISOString(),
        };
        const allowDap = input.variable !== "alt";
        const allowAlt = input.variable !== "dap";
        if (r.is_dap && allowDap && r.dap_eq !== null) {
          const hi = r.dap_max ?? r.dap_eq;
          const sd = r.dap_sd && r.dap_sd > 0 ? r.dap_sd : 1;
          const deviation = (r.dap_eq - (r.dap_mean ?? hi)) / sd;
          items.push({
            ...base,
            deviation,
            hi,
            id: `${r.id}:dap`,
            lo: r.dap_min ?? 1,
            strong: deviation >= 5,
            value: r.dap_eq,
            variable: "dap",
          });
        }
        if (r.is_alt && allowAlt && r.height !== null) {
          const hi = r.height_max ?? r.height;
          const deviation = r.height - hi;
          items.push({
            ...base,
            deviation,
            hi,
            id: `${r.id}:alt`,
            lo: 1.5,
            strong: deviation >= 4,
            value: r.height,
            variable: "alt",
          });
        }
        return items;
      });

      const [range] = (
        await db.execute<{ min_d: string | null; max_d: string | null }>(sql`
        SELECT min((measured_at AT TIME ZONE 'America/Lima')::date)::text AS min_d,
               max((measured_at AT TIME ZONE 'America/Lima')::date)::text AS max_d
        FROM measurement
      `)
      ).rows;

      return {
        counts: {
          all: counts.all_n,
          done: counts.all_n - counts.open_n,
          open: counts.open_n,
        },
        dataRange: { max: range?.max_d ?? null, min: range?.min_d ?? null },
        feed,
        kpis: {
          alertsTotal: kpis?.alerts_total ?? 0,
          altOut: kpis?.alt_out ?? 0,
          dapOut: kpis?.dap_out ?? 0,
          pending: kpis?.pending ?? 0,
          total: kpis?.total ?? 0,
          validated: kpis?.validated ?? 0,
        },
        lastReceivedAt: kpis?.last_sync
          ? new Date(kpis.last_sync).toISOString()
          : null,
        species: speciesRows.map((s) => ({
          altDots: dotsBySpecies.get(s.id)?.alt ?? [],
          altOut: s.alt_out,
          dapDots: dotsBySpecies.get(s.id)?.dap ?? [],
          dapMax: s.dap_max,
          dapMean: s.dap_mean,
          dapMin: s.dap_min,
          dapOut: s.dap_out,
          heightMax: s.height_max,
          heightMean: s.height_mean,
          id: s.id,
          n: s.n,
          name: s.name,
        })),
      };
    }),

  resolve: staffProcedure
    .input(
      z.object({
        action: z.enum(["accept", "remeasure"]),
        measurementId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ plotNumber: measurement.plotNumber })
        .from(measurement)
        .where(eq(measurement.id, input.measurementId))
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Medición no encontrada",
        });
      }
      await ctx.db
        .update(measurement)
        .set({
          review: input.action === "accept" ? "accepted" : "remeasure",
          reviewedAt: new Date(),
          reviewedBy: ctx.actor.id,
        })
        .where(eq(measurement.id, input.measurementId));
      await refreshPlotStatuses(ctx.db, [row.plotNumber], "review");
      const [treeRow] = await ctx.db
        .select({ code: tree.code })
        .from(measurement)
        .innerJoin(tree, eq(tree.id, measurement.treeId))
        .where(eq(measurement.id, input.measurementId))
        .limit(1);
      await writeAudit(ctx.db, ctx.actor, {
        action:
          input.action === "accept"
            ? "measurement.accept"
            : "measurement.remeasure",
        detail: { code: treeRow?.code },
        entity: "measurement",
        entityId: input.measurementId,
        plotNumber: row.plotNumber,
      });
    }),
});
