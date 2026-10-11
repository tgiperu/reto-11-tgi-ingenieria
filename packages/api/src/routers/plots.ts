import {
  brigade,
  sector,
  species,
} from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  auditLog,
  measurement,
  measurementPhoto,
  plot,
  tree,
} from "@reto-11-tgi-ingenieria/db/schema/inventory";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  type CategoryKey,
} from "@reto-11-tgi-ingenieria/domain/categories";
import { ANPS, STRATA } from "@reto-11-tgi-ingenieria/domain/constants";
import {
  utmDistanceMeters,
  utmToLatLon,
} from "@reto-11-tgi-ingenieria/domain/geo";
import { HEALTH_KEYS } from "@reto-11-tgi-ingenieria/domain/health";
import { deriveMetrics } from "@reto-11-tgi-ingenieria/domain/measure";
import { normalizeKey, tidy } from "@reto-11-tgi-ingenieria/domain/names";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router, staffProcedure } from "../index";
import { writeAudit } from "../lib/audit";
import { evaluateFields, initialReview, loadSpecies } from "../lib/evaluation";
import {
  bumpCatalogVersion,
  getEquations,
  getPublishedRules,
} from "../lib/settings";

const DEFAULT_LIST_LIMIT = 7;
const MAX_RECORDS_PAGE = 300;

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type PlotAggregate = {
  ar: number;
  br: number;
  carbon: number;
  fu: number;
  individuals: number;
  la: number;
  last_at: string | null;
  open_alerts: number;
  plot_number: number;
  species: number;
};

/** Agregados por parcela sobre la última medición de cada árbol. */
async function plotAggregates(
  db: Parameters<typeof loadSpecies>[0]
): Promise<Map<number, PlotAggregate>> {
  const result = await db.execute<PlotAggregate>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (tree_id) *
      FROM measurement
      ORDER BY tree_id, measured_at DESC
    )
    SELECT plot_number,
           count(*)::int AS individuals,
           count(DISTINCT species_id)::int AS species,
           coalesce(sum(carbon_total), 0)::float AS carbon,
           count(*) FILTER (WHERE review IN ('pending', 'justified'))::int AS open_alerts,
           count(*) FILTER (WHERE category = 'la')::int AS la,
           count(*) FILTER (WHERE category = 'fu')::int AS fu,
           count(*) FILTER (WHERE category = 'ar')::int AS ar,
           count(*) FILTER (WHERE category = 'br')::int AS br,
           max(measured_at) AS last_at
    FROM latest
    GROUP BY plot_number
  `);
  return new Map(result.rows.map((r) => [r.plot_number, r]));
}

export const plotsRouter = router({
  /** Asigna la parcela a una brigada y la abre para registrar en campo. */
  assign: adminProcedure
    .input(z.object({ brigadeId: z.string().min(1), plot: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(plot)
        .set({ brigadeId: input.brigadeId, closedAt: null, status: "assigned" })
        .where(eq(plot.number, input.plot));
      await writeAudit(ctx.db, ctx.actor, {
        action: "plot.assign",
        detail: { brigadeId: input.brigadeId },
        plotNumber: input.plot,
      });
    }),

  audit: staffProcedure
    .input(z.object({ plot: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.plotNumber, input.plot))
        .orderBy(desc(auditLog.at))
        .limit(50);
      return rows.map((r) => ({
        action: r.action,
        at: r.at.toISOString(),
        detail: r.detail,
        id: r.id,
        reason: r.reason,
        userName: r.userName,
      }));
    }),

  close: staffProcedure
    .input(z.object({ plot: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [open] = await ctx.db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(measurement)
        .where(
          and(
            eq(measurement.plotNumber, input.plot),
            sql`${measurement.review} IN ('pending', 'justified')`
          )
        );
      if ((open?.n ?? 0) > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Aún hay ${open?.n} alertas por revisar en P-${input.plot}`,
        });
      }
      await ctx.db
        .update(plot)
        .set({ closedAt: new Date(), status: "locked" })
        .where(eq(plot.number, input.plot));
      await writeAudit(ctx.db, ctx.actor, {
        action: "plot.lock",
        plotNumber: input.plot,
      });
    }),

  correct: adminProcedure
    .input(
      z.object({
        category: z.enum(CATEGORY_KEYS).optional(),
        crownMax: z.number().nonnegative().nullable().optional(),
        crownMin: z.number().nonnegative().nullable().optional(),
        dac1: z.number().nonnegative().nullable().optional(),
        dac2: z.number().nonnegative().nullable().optional(),
        health: z.enum(HEALTH_KEYS).nullable().optional(),
        height: z.number().nonnegative().max(80).nullable().optional(),
        id: z.string().uuid(),
        notes: z.string().max(2000).optional(),
        reason: z.string().trim().min(3).max(300),
        speciesId: z.number().int().nullable().optional(),
        stems: z.array(z.number().positive().max(500)).max(40).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const [row] = await db
        .select()
        .from(measurement)
        .where(eq(measurement.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registro no encontrado",
        });
      }
      const [plotRow] = await db
        .select()
        .from(plot)
        .where(eq(plot.number, row.plotNumber))
        .limit(1);
      if (plotRow?.status !== "unlocked") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Desbloquea la parcela antes de corregir sus registros",
        });
      }
      const next = {
        category: (input.category ?? row.category) as CategoryKey,
        crownMax: input.crownMax === undefined ? row.crownMax : input.crownMax,
        crownMin: input.crownMin === undefined ? row.crownMin : input.crownMin,
        dac1: input.dac1 === undefined ? row.dac1 : input.dac1,
        dac2: input.dac2 === undefined ? row.dac2 : input.dac2,
        health: input.health === undefined ? row.health : input.health,
        height: input.height === undefined ? row.height : input.height,
        notes: input.notes ?? row.notes,
        speciesId:
          input.speciesId === undefined ? row.speciesId : input.speciesId,
        stems: input.stems ?? row.stems,
      };
      const metrics = deriveMetrics(next);
      const [treeRow] = await db
        .select()
        .from(tree)
        .where(eq(tree.id, row.treeId))
        .limit(1);
      const speciesMap = await loadSpecies(db);
      const { alerts, carbon } = evaluateFields(
        {
          category: next.category,
          codeLabel: treeRow?.code ?? "",
          crownAvg: metrics.crownAvg,
          dacAvg: metrics.dacAvg,
          dapEq: metrics.dapEq,
          height: next.height,
          notes: next.notes,
          photoCount: row.hasPhoto ? 1 : 0,
          speciesId: next.speciesId,
        },
        {
          equations: await getEquations(db),
          rules: (await getPublishedRules(db)).settings,
          species: speciesMap,
        }
      );
      const review = initialReview(alerts, row.hasPhoto);
      await db
        .update(measurement)
        .set({
          alerts,
          carbonAerial: carbon.aerial,
          carbonRoot: carbon.root,
          carbonTotal: carbon.total,
          category: next.category,
          crownMax: next.crownMax,
          crownMin: next.crownMin,
          dac1: next.dac1,
          dac2: next.dac2,
          dapEq: metrics.dapEq,
          health: next.health,
          height: next.height,
          notes: next.notes,
          review,
          speciesId: next.speciesId,
          stems: next.stems,
        })
        .where(eq(measurement.id, row.id));
      if (treeRow && (input.speciesId !== undefined || input.category)) {
        await db
          .update(tree)
          .set({ category: next.category, speciesId: next.speciesId })
          .where(eq(tree.id, treeRow.id));
      }
      await writeAudit(ctx.db, ctx.actor, {
        action: "measurement.correct",
        detail: {
          after: {
            category: next.category,
            dapEq: metrics.dapEq,
            height: next.height,
            speciesId: next.speciesId,
          },
          before: {
            category: row.category,
            dapEq: row.dapEq,
            height: row.height,
            speciesId: row.speciesId,
          },
          code: treeRow?.code,
        },
        entity: "measurement",
        entityId: row.id,
        plotNumber: row.plotNumber,
        reason: input.reason,
      });
    }),

  create: staffProcedure
    .input(
      z.object({
        anp: z.enum(ANPS).nullable(),
        brigadeId: z.string().nullable(),
        cabE: z.number().nullable(),
        cabN: z.number().nullable(),
        number: z.number().int().positive(),
        sector: z.string().trim().min(2).max(120),
        stratum: z.enum(STRATA),
        utmE: z.number().nullable(),
        utmN: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const [dup] = await db
        .select()
        .from(plot)
        .where(eq(plot.number, input.number))
        .limit(1);
      if (dup) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `P-${input.number} ya existe`,
        });
      }
      const name = tidy(input.sector);
      const sectors = await db.select().from(sector);
      let sectorRow = sectors.find(
        (s) => normalizeKey(s.name) === normalizeKey(name)
      );
      if (!sectorRow) {
        [sectorRow] = await db.insert(sector).values({ name }).returning();
      }
      if (!sectorRow) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo crear el sector",
        });
      }
      const coords =
        input.utmE !== null && input.utmN !== null
          ? utmToLatLon(input.utmE, input.utmN)
          : null;
      const deviation =
        input.utmE !== null &&
        input.utmN !== null &&
        input.cabE !== null &&
        input.cabN !== null
          ? utmDistanceMeters(input.utmE, input.utmN, input.cabE, input.cabN)
          : null;
      await db.insert(plot).values({
        anp: input.anp,
        brigadeId: input.brigadeId,
        cabE: input.cabE,
        cabN: input.cabN,
        deviationM: deviation,
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
        number: input.number,
        sectorId: sectorRow.id,
        stratum: input.stratum,
        utmE: input.utmE,
        utmN: input.utmN,
      });
      await bumpCatalogVersion(db);
      await writeAudit(db, ctx.actor, {
        action: "plot.create",
        plotNumber: input.number,
      });
      return { number: input.number };
    }),

  get: staffProcedure
    .input(z.object({ plot: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          anp: plot.anp,
          brigadeId: plot.brigadeId,
          leader: brigade.leaderName,
          number: plot.number,
          sector: sector.name,
          status: plot.status,
          stratum: plot.stratum,
        })
        .from(plot)
        .innerJoin(sector, eq(sector.id, plot.sectorId))
        .leftJoin(brigade, eq(brigade.id, plot.brigadeId))
        .where(eq(plot.number, input.plot))
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Parcela no encontrada",
        });
      }
      const [open] = await ctx.db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(measurement)
        .where(
          and(
            eq(measurement.plotNumber, input.plot),
            sql`${measurement.review} IN ('pending', 'justified')`
          )
        );
      return { ...row, openAlerts: open?.n ?? 0 };
    }),

  list: staffProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).default(DEFAULT_LIST_LIMIT),
          search: z.string().max(80).optional(),
          status: z.enum(["all", "locked", "review", "alert"]).default("all"),
        })
        .default({ limit: DEFAULT_LIST_LIMIT, status: "all" })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const rows = await db
        .select({
          brigadeId: plot.brigadeId,
          leader: brigade.leaderName,
          number: plot.number,
          sampleDate: plot.sampleDate,
          sector: sector.name,
          status: plot.status,
          stratum: plot.stratum,
        })
        .from(plot)
        .innerJoin(sector, eq(sector.id, plot.sectorId))
        .leftJoin(brigade, eq(brigade.id, plot.brigadeId))
        .orderBy(desc(plot.number));
      const aggregates = await plotAggregates(db);
      const q = normalizeKey(input.search ?? "");
      const all = rows
        .filter(
          (r) =>
            q === "" ||
            normalizeKey(
              `${r.number} p ${r.sector} ${r.stratum} ${r.leader ?? ""}`
            ).includes(q)
        )
        .map((r) => {
          const agg = aggregates.get(r.number);
          return {
            brigade: r.leader ?? r.brigadeId ?? "—",
            carbon: agg?.carbon ?? 0,
            date: r.sampleDate,
            individuals: agg?.individuals ?? 0,
            number: r.number,
            openAlerts: agg?.open_alerts ?? 0,
            sector: r.sector,
            status: r.status,
            stratum: r.stratum,
          };
        });
      const counts = {
        alert: all.filter((r) => r.status === "alert").length,
        all: all.length,
        locked: all.filter(
          (r) => r.status === "locked" || r.status === "unlocked"
        ).length,
        review: all.filter((r) => r.status === "review").length,
      };
      const filtered = all.filter((r) => {
        if (input.status === "all") {
          return true;
        }
        if (input.status === "locked") {
          return r.status === "locked" || r.status === "unlocked";
        }
        return r.status === input.status;
      });
      return {
        counts,
        rows: filtered.slice(0, input.limit),
        shown: Math.min(filtered.length, input.limit),
        total: filtered.length,
      };
    }),

  map: staffProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    const rows = await db
      .select({
        anp: plot.anp,
        cabE: plot.cabE,
        cabN: plot.cabN,
        crew: plot.crew,
        deviationM: plot.deviationM,
        lat: plot.lat,
        leader: brigade.leaderName,
        lon: plot.lon,
        number: plot.number,
        sampleDate: plot.sampleDate,
        sector: sector.name,
        status: plot.status,
        stratum: plot.stratum,
        utmE: plot.utmE,
        utmN: plot.utmN,
      })
      .from(plot)
      .innerJoin(sector, eq(sector.id, plot.sectorId))
      .leftJoin(brigade, eq(brigade.id, plot.brigadeId))
      .orderBy(plot.number);
    const aggregates = await plotAggregates(db);
    const top = await db.execute<{ plot_number: number; names: string[] }>(sql`
      SELECT plot_number, array_agg(name ORDER BY n DESC) AS names FROM (
        SELECT m.plot_number, sp.name, count(*) AS n,
               row_number() OVER (PARTITION BY m.plot_number ORDER BY count(*) DESC) AS rk
        FROM measurement m JOIN species sp ON sp.id = m.species_id
        GROUP BY m.plot_number, sp.name
      ) t WHERE rk <= 3 GROUP BY plot_number
    `);
    const topBy = new Map(top.rows.map((t) => [t.plot_number, t.names]));
    return rows.map((r) => {
      const agg = aggregates.get(r.number);
      return {
        ...r,
        alerts: agg?.open_alerts ?? 0,
        carbon: agg?.carbon ?? 0,
        categoryCounts: {
          ar: agg?.ar ?? 0,
          br: agg?.br ?? 0,
          la: (agg?.la ?? 0) + (agg?.fu ?? 0),
        },
        individuals: agg?.individuals ?? 0,
        species: agg?.species ?? 0,
        topSpecies: topBy.get(r.number) ?? [],
      };
    });
  }),

  photo: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          category: measurement.category,
          code: tree.code,
          createdAt: measurementPhoto.createdAt,
          dapEq: measurement.dapEq,
          data: measurementPhoto.data,
          height: measurement.height,
          mime: measurementPhoto.mime,
          plotNumber: measurement.plotNumber,
          species: species.name,
        })
        .from(measurementPhoto)
        .innerJoin(
          measurement,
          eq(measurement.id, measurementPhoto.measurementId)
        )
        .innerJoin(tree, eq(tree.id, measurement.treeId))
        .leftJoin(species, eq(species.id, measurement.speciesId))
        .where(eq(measurementPhoto.measurementId, input.id))
        .limit(1);
      return row
        ? {
            category: row.category,
            code: row.code,
            createdAt: row.createdAt.toISOString(),
            dapEq: row.dapEq,
            dataUrl: `data:${row.mime};base64,${row.data}`,
            height: row.height,
            plot: row.plotNumber,
            species: row.species ?? "Sin especie",
          }
        : null;
    }),

  records: staffProcedure
    .input(
      z.object({
        category: z.enum(CATEGORY_KEYS),
        offset: z.number().int().min(0).default(0),
        plot: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { series } = CATEGORIES[input.category];
      const result = await ctx.db.execute<{
        id: string;
        code: string;
        category: string;
        species_name: string | null;
        species_id: number | null;
        stems: number[];
        dap_eq: number | null;
        height: number | null;
        crown_min: number | null;
        crown_max: number | null;
        dac1: number | null;
        dac2: number | null;
        health: string | null;
        has_photo: boolean;
        review: string;
        alerts: { rule: string; title: string }[];
        notes: string;
        carbon_total: number | null;
        measured_at: string;
      }>(sql`
        SELECT * FROM (
          SELECT DISTINCT ON (t.id) m.id, t.code, m.category, sp.name AS species_name, m.species_id,
                 m.stems, m.dap_eq, m.height, m.crown_min, m.crown_max, m.dac1, m.dac2, m.health,
                 m.has_photo, m.review, m.alerts, m.notes, m.carbon_total, m.measured_at
          FROM tree t
          JOIN measurement m ON m.tree_id = t.id
          LEFT JOIN species sp ON sp.id = m.species_id
          WHERE t.plot_number = ${input.plot} AND t.series = ${series}
            AND (${input.category} IN ('ar', 'br') OR m.category = ${input.category})
          ORDER BY t.id, m.measured_at DESC
        ) x
        ORDER BY (x.code)::int
        LIMIT ${MAX_RECORDS_PAGE} OFFSET ${input.offset}
      `);
      const [{ n } = { n: 0 }] = (
        await ctx.db.execute<{ n: number }>(sql`
          SELECT count(DISTINCT t.id)::int AS n FROM tree t JOIN measurement m ON m.tree_id = t.id
          WHERE t.plot_number = ${input.plot} AND t.series = ${series}
            AND (${input.category} IN ('ar', 'br') OR m.category = ${input.category})
        `)
      ).rows;
      return {
        rows: result.rows.map((r) => ({
          alerts: r.alerts,
          carbon: r.carbon_total,
          category: r.category,
          code: r.code,
          crownMax: r.crown_max,
          crownMin: r.crown_min,
          dac1: r.dac1,
          dac2: r.dac2,
          dapEq: r.dap_eq,
          hasPhoto: r.has_photo,
          health: r.health,
          height: r.height,
          id: r.id,
          measuredAt: new Date(r.measured_at).toISOString(),
          notes: r.notes,
          review: r.review,
          speciesId: r.species_id,
          speciesName: r.species_name,
          stems: r.stems,
        })),
        total: n,
      };
    }),

  relock: adminProcedure
    .input(z.object({ plot: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(plot)
        .set({ closedAt: new Date(), status: "locked" })
        .where(eq(plot.number, input.plot));
      await writeAudit(ctx.db, ctx.actor, {
        action: "plot.relock",
        plotNumber: input.plot,
      });
    }),

  unlock: adminProcedure
    .input(
      z.object({
        plot: z.number().int(),
        reason: z.string().trim().min(3).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(plot)
        .set({ closedAt: null, status: "unlocked" })
        .where(eq(plot.number, input.plot));
      await writeAudit(ctx.db, ctx.actor, {
        action: "plot.unlock",
        plotNumber: input.plot,
        reason: input.reason,
      });
    }),
});
