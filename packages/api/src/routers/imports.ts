import {
  brigade,
  sector,
  species,
} from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  importBatch,
  measurement,
  plot,
  tree,
} from "@reto-11-tgi-ingenieria/db/schema/inventory";
import type { EquationKey } from "@reto-11-tgi-ingenieria/domain/carbon";
import { carbonOf } from "@reto-11-tgi-ingenieria/domain/carbon";
import { CATEGORIES } from "@reto-11-tgi-ingenieria/domain/categories";
import { ANPS, STRATA } from "@reto-11-tgi-ingenieria/domain/constants";
import {
  utmDistanceMeters,
  utmToLatLon,
} from "@reto-11-tgi-ingenieria/domain/geo";
import { importRecordSchema } from "@reto-11-tgi-ingenieria/domain/import";
import { deriveMetrics } from "@reto-11-tgi-ingenieria/domain/measure";
import { normalizeKey } from "@reto-11-tgi-ingenieria/domain/names";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router, staffProcedure } from "../index";
import { writeAudit } from "../lib/audit";
import {
  loadSpecies,
  recomputeSpeciesStats,
  reevaluateMeasurements,
  refreshPlotStatuses,
} from "../lib/evaluation";
import {
  bumpCatalogVersion,
  getEquations,
  getPublishedRules,
} from "../lib/settings";

const DEFAULT_K = 3;
const DEFAULT_TIME = "12:00";
const LIMA_OFFSET = "-05:00";
const MAX_CHUNK = 500;
const INSERT_SLICE = 250;

function measuredAtOf(date: string | null, time: string | null): Date {
  if (!date) {
    return new Date();
  }
  const parsed = new Date(`${date}T${time ?? DEFAULT_TIME}:00${LIMA_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function matchStratum(value: string | null): string {
  if (!value) {
    return "Sin estrato";
  }
  const key = normalizeKey(value);
  return STRATA.find((s) => normalizeKey(s) === key) ?? value;
}

function matchAnp(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const key = normalizeKey(value);
  if (key.includes("amotape") || key === "pncam") {
    return ANPS[0];
  }
  if (key.includes("angolo") || key === "ccean") {
    return ANPS[1];
  }
  return null;
}

export const importsRouter = router({
  begin: adminProcedure
    .input(
      z.object({ fileName: z.string().max(200), rows: z.number().int().min(0) })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(importBatch)
        .values({
          createdBy: ctx.actor.id,
          fileName: input.fileName,
          rows: input.rows,
        })
        .returning({ id: importBatch.id });
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo iniciar la importación",
        });
      }
      return { batchId: row.id };
    }),

  chunk: adminProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
        records: z.array(importRecordSchema).min(1).max(MAX_CHUNK),
      })
    )
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { records } = input;

      // Catálogos: sectores y especies que falten.
      const sectorRows = await db.select().from(sector);
      const sectorByKey = new Map(
        sectorRows.map((s) => [normalizeKey(s.name), s])
      );
      const missingSectors = [...new Set(records.map((r) => r.sector))].filter(
        (name) => !sectorByKey.has(normalizeKey(name))
      );
      if (missingSectors.length > 0) {
        const inserted = await db
          .insert(sector)
          .values(missingSectors.map((name) => ({ name })))
          .onConflictDoNothing()
          .returning();
        for (const s of inserted) {
          sectorByKey.set(normalizeKey(s.name), s);
        }
        const again = await db.select().from(sector);
        for (const s of again) {
          sectorByKey.set(normalizeKey(s.name), s);
        }
      }

      const speciesRows = await db.select().from(species);
      const speciesByKey = new Map(
        speciesRows.map((s) => [normalizeKey(s.name), s])
      );
      const missingSpecies = new Map<
        string,
        { name: string; shrub: boolean }
      >();
      for (const r of records) {
        const key = normalizeKey(r.species);
        if (!speciesByKey.has(key)) {
          const prev = missingSpecies.get(key);
          missingSpecies.set(key, {
            name: r.species,
            shrub: (prev?.shrub ?? true) && r.category === "ar",
          });
        }
      }
      if (missingSpecies.size > 0) {
        await db
          .insert(species)
          .values(
            [...missingSpecies.entries()].map(([key, v]) => ({
              equationKey: key === "overo" ? "overo" : null,
              isNN: key.startsWith("nn"),
              lifeForm: v.shrub ? "Arbusto" : "Árbol",
              name: v.name,
            }))
          )
          .onConflictDoNothing();
        const again = await db.select().from(species);
        for (const s of again) {
          speciesByKey.set(normalizeKey(s.name), s);
        }
      }

      // Parcelas.
      const brigadeRows = await db.select().from(brigade);
      const brigadeFor = (value: string | null) => {
        if (!value) {
          return null;
        }
        const key = normalizeKey(value);
        return (
          brigadeRows.find(
            (b) =>
              normalizeKey(b.id) === key || normalizeKey(b.leaderName) === key
          )?.id ?? null
        );
      };
      const plotNumbers = [...new Set(records.map((r) => r.plot))];
      const existingPlots = await db
        .select()
        .from(plot)
        .where(inArray(plot.number, plotNumbers));
      const existingPlotSet = new Set(existingPlots.map((p) => p.number));
      const newPlots = new Map<number, typeof plot.$inferInsert>();
      for (const r of records) {
        if (existingPlotSet.has(r.plot) || newPlots.has(r.plot)) {
          continue;
        }
        const sectorRow = sectorByKey.get(normalizeKey(r.sector));
        if (!sectorRow) {
          continue;
        }
        const coords =
          r.utmE !== null && r.utmN !== null
            ? utmToLatLon(r.utmE, r.utmN)
            : null;
        const deviation =
          r.utmE !== null &&
          r.utmN !== null &&
          r.cabE !== null &&
          r.cabN !== null
            ? utmDistanceMeters(r.utmE, r.utmN, r.cabE, r.cabN)
            : null;
        newPlots.set(r.plot, {
          anp: matchAnp(r.anp),
          brigadeId: brigadeFor(r.brigade),
          cabE: r.cabE,
          cabN: r.cabN,
          deviationM: deviation,
          lat: coords?.lat ?? null,
          lon: coords?.lon ?? null,
          number: r.plot,
          sampleDate: r.date,
          sectorId: sectorRow.id,
          status: "locked",
          stratum: matchStratum(r.stratum),
          timeEnd: r.timeEnd,
          timeStart: r.timeStart,
          utmE: r.utmE,
          utmN: r.utmN,
        });
      }
      if (newPlots.size > 0) {
        await db
          .insert(plot)
          .values([...newPlots.values()])
          .onConflictDoNothing();
      }

      // Árboles: se reutilizan los que ya existen (misma parcela, serie y código).
      const treeKey = (p: number, series: string, code: string) =>
        `${p}|${series}|${code}`;
      const existingTrees = await db
        .select()
        .from(tree)
        .where(
          and(
            inArray(tree.plotNumber, plotNumbers),
            inArray(tree.code, [...new Set(records.map((r) => r.code))])
          )
        );
      const treeByKey = new Map(
        existingTrees.map((t) => [treeKey(t.plotNumber, t.series, t.code), t])
      );
      const newTrees: (typeof tree.$inferInsert)[] = [];
      for (const r of records) {
        const { series } = CATEGORIES[r.category];
        const key = treeKey(r.plot, series, r.code);
        if (!treeByKey.has(key)) {
          const row = {
            category: r.category,
            code: r.code,
            id: crypto.randomUUID(),
            plotNumber: r.plot,
            series,
            speciesId: speciesByKey.get(normalizeKey(r.species))?.id ?? null,
          };
          treeByKey.set(key, { ...row, createdAt: new Date() });
          newTrees.push(row);
        }
      }
      for (let i = 0; i < newTrees.length; i += INSERT_SLICE) {
        // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
        await db.insert(tree).values(newTrees.slice(i, i + INSERT_SLICE));
      }

      // Evita duplicar mediciones si se vuelve a importar el mismo archivo.
      const treeIds = [...treeByKey.values()].map((t) => t.id);
      const already = new Set<string>();
      if (treeIds.length > 0 && existingTrees.length > 0) {
        const rows = await db
          .select({ treeId: measurement.treeId })
          .from(measurement)
          .where(
            and(
              eq(measurement.source, "import"),
              inArray(
                measurement.treeId,
                existingTrees.map((t) => t.id)
              )
            )
          );
        for (const r of rows) {
          already.add(r.treeId);
        }
      }

      const equations = await getEquations(db);
      const rows: (typeof measurement.$inferInsert)[] = [];
      for (const r of records) {
        const { series } = CATEGORIES[r.category];
        const treeRow = treeByKey.get(treeKey(r.plot, series, r.code));
        if (!treeRow || already.has(treeRow.id)) {
          continue;
        }
        const metrics = deriveMetrics(r);
        const sp = speciesByKey.get(normalizeKey(r.species));
        const carbon = carbonOf(
          {
            category: r.category,
            crownAvg: metrics.crownAvg,
            dacAvg: metrics.dacAvg,
            dapEq: metrics.dapEq,
            equationKey: (sp?.equationKey ?? null) as EquationKey,
          },
          equations
        );
        rows.push({
          carbonAerial: carbon.aerial,
          carbonRoot: carbon.root,
          carbonTotal: carbon.total,
          category: r.category,
          crownMax: r.crownMax,
          crownMin: r.crownMin,
          dac1: r.dac1,
          dac2: r.dac2,
          dapEq: metrics.dapEq,
          health: r.health,
          height: r.height,
          measuredAt: measuredAtOf(r.date, r.timeStart),
          notes: r.notes,
          plotNumber: r.plot,
          source: "import",
          speciesId: sp?.id ?? null,
          stems: r.stems,
          treeId: treeRow.id,
          userId: ctx.actor.id,
        });
      }
      for (let i = 0; i < rows.length; i += INSERT_SLICE) {
        // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
        await db.insert(measurement).values(rows.slice(i, i + INSERT_SLICE));
      }
      return {
        measurements: rows.length,
        skipped: records.length - rows.length,
        trees: newTrees.length,
      };
    }),

  context: staffProcedure.query(async ({ ctx }) => {
    const sectors = await ctx.db.select({ name: sector.name }).from(sector);
    const speciesRows = await ctx.db
      .select({ name: species.name })
      .from(species);
    return {
      sectors: sectors.map((s) => s.name),
      species: speciesRows.map((s) => s.name),
    };
  }),

  finish: adminProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
        records: z.number().int().min(0),
        summary: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const published = await getPublishedRules(db);
      const k =
        published.settings.find((s) => s.key === "dap")?.param ?? DEFAULT_K;
      await recomputeSpeciesStats(db, k);
      const reevaluated = await reevaluateMeasurements(
        db,
        {
          equations: await getEquations(db),
          rules: published.settings,
          species: await loadSpecies(db),
        },
        sql`m.source = 'import'`
      );
      await refreshPlotStatuses(db, null, "locked");
      await bumpCatalogVersion(db);
      await db
        .update(importBatch)
        .set({
          records: input.records,
          summary: { ...input.summary, reevaluated },
        })
        .where(eq(importBatch.id, input.batchId));
      await writeAudit(db, ctx.actor, {
        action: "import",
        detail: { batchId: input.batchId, reevaluated, ...input.summary },
        entity: "import",
        entityId: input.batchId,
      });
      return { reevaluated };
    }),
});
