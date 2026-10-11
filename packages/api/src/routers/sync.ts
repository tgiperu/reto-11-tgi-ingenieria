import {
  brigade,
  sector,
  species,
} from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  measurement,
  measurementPhoto,
  plot,
  tree,
} from "@reto-11-tgi-ingenieria/db/schema/inventory";
import {
  CATEGORIES,
  type CategoryKey,
  type CodeSeries,
} from "@reto-11-tgi-ingenieria/domain/categories";
import type { PlotStatus } from "@reto-11-tgi-ingenieria/domain/constants";
import { distanceMeters } from "@reto-11-tgi-ingenieria/domain/geo";
import { healthRequired } from "@reto-11-tgi-ingenieria/domain/health";
import { deriveMetrics } from "@reto-11-tgi-ingenieria/domain/measure";
import {
  type PullBundle,
  type PullPlot,
  type PullTree,
  type PushRecord,
  type PushResult,
  pushInputSchema,
} from "@reto-11-tgi-ingenieria/domain/sync";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { memberProcedure, router } from "../index";
import { writeAudit } from "../lib/audit";
import {
  evaluateFields,
  initialReview,
  loadSpecies,
  refreshPlotStatuses,
} from "../lib/evaluation";
import {
  getCatalogVersion,
  getEquations,
  getPublishedRules,
} from "../lib/settings";

const CLOSED_FOR_FIELD: readonly PlotStatus[] = [
  "review",
  "alert",
  "locked",
  "unlocked",
];
const PHOTO_INSERT_CHUNK = 4;

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type LatestRow = {
  category: CategoryKey;
  code: string;
  dap_eq: number | null;
  height: number | null;
  measured_at: string | null;
  plot_number: number;
  series: CodeSeries;
  species_id: number | null;
  species_name: string | null;
};

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type PreviousRow = {
  dap_eq: number | null;
  species_id: number | null;
  species_name: string | null;
  tree_id: string;
};

function treeKey(plotNumber: number, series: string, code: string): string {
  return `${plotNumber}|${series}|${code}`;
}

export const syncRouter = router({
  pull: memberProcedure.query(async ({ ctx }): Promise<PullBundle> => {
    const { db } = ctx;
    const { user } = ctx.session;
    const brigadeId = user.brigadeId ?? null;
    const [brigadeRow] = brigadeId
      ? await db
          .select()
          .from(brigade)
          .where(eq(brigade.id, brigadeId))
          .limit(1)
      : [];

    const plotRows = await db
      .select({
        lat: plot.lat,
        lon: plot.lon,
        number: plot.number,
        sector: sector.name,
        status: plot.status,
        stratum: plot.stratum,
      })
      .from(plot)
      .innerJoin(sector, eq(sector.id, plot.sectorId))
      .where(brigadeId ? eq(plot.brigadeId, brigadeId) : undefined)
      .orderBy(plot.number);
    const plots: PullPlot[] = plotRows.map((p) => ({
      closed: CLOSED_FOR_FIELD.includes(p.status as PlotStatus),
      lat: p.lat,
      lon: p.lon,
      number: p.number,
      sector: p.sector,
      status: p.status as PlotStatus,
      stratum: p.stratum,
    }));

    const plotNumbers = plots.map((p) => p.number);
    let trees: PullTree[] = [];
    if (plotNumbers.length > 0) {
      const latest = await db.execute<LatestRow>(sql`
        SELECT DISTINCT ON (t.id) t.plot_number, t.series, t.category, t.code, t.species_id,
               sp.name AS species_name, m.dap_eq, m.height, m.measured_at
        FROM tree t
        LEFT JOIN species sp ON sp.id = t.species_id
        LEFT JOIN measurement m ON m.tree_id = t.id
        WHERE t.plot_number IN (${sql.join(
          plotNumbers.map((n) => sql`${n}`),
          sql`, `
        )})
        ORDER BY t.id, m.measured_at DESC
      `);
      trees = latest.rows.map((r) => ({
        category: r.category,
        code: r.code,
        dapEq: r.dap_eq,
        height: r.height,
        measuredAt: r.measured_at ? new Date(r.measured_at).toISOString() : "",
        plot: r.plot_number,
        series: r.series,
        speciesId: r.species_id,
        speciesName: r.species_name,
      }));
    }

    const counts = await db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        id: measurement.speciesId,
      })
      .from(measurement)
      .where(isNotNull(measurement.speciesId))
      .groupBy(measurement.speciesId);
    const countBySpecies = new Map(counts.map((c) => [c.id, c.count]));
    const speciesRows = await db.select().from(species).orderBy(species.name);
    const published = await getPublishedRules(db);

    return {
      catalogVersion: await getCatalogVersion(db),
      plots,
      rules: published.settings,
      rulesVersion: published.label,
      serverTime: new Date().toISOString(),
      species: speciesRows.map((s) => ({
        count: countBySpecies.get(s.id) ?? 0,
        dapMax: s.dapMax,
        hMax: s.heightMax,
        id: s.id,
        isNN: s.isNN,
        name: s.name,
        scientificName: s.scientificName,
      })),
      trees,
      user: {
        brigadeId,
        brigadeName: brigadeRow ? brigadeRow.id : null,
        id: user.id,
        name: user.name,
        role: ctx.role,
      },
    };
  }),

  push: memberProcedure
    .input(pushInputSchema)
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const brigadeId = ctx.session.user.brigadeId ?? null;
      const { records } = input;
      const results = new Map<string, PushResult>();

      const ids = records.map((r) => r.clientId);
      const already = await db
        .select({ id: measurement.id })
        .from(measurement)
        .where(inArray(measurement.id, ids));
      const alreadySet = new Set(already.map((a) => a.id));

      const plotNumbers = [...new Set(records.map((r) => r.plotNumber))];
      const plotRows = await db
        .select()
        .from(plot)
        .where(inArray(plot.number, plotNumbers));
      const plotByNumber = new Map(plotRows.map((p) => [p.number, p]));

      const codes = [...new Set(records.map((r) => r.code))];
      const treeRows = await db
        .select()
        .from(tree)
        .where(
          and(inArray(tree.plotNumber, plotNumbers), inArray(tree.code, codes))
        );
      const treeByKey = new Map(
        treeRows.map((t) => [treeKey(t.plotNumber, t.series, t.code), t])
      );

      const existingTreeIds = treeRows.map((t) => t.id);
      const previousByTree = new Map<string, PreviousRow>();
      if (existingTreeIds.length > 0) {
        const prev = await db.execute<PreviousRow>(sql`
        SELECT DISTINCT ON (m.tree_id) m.tree_id, m.species_id, sp.name AS species_name, m.dap_eq
        FROM measurement m LEFT JOIN species sp ON sp.id = m.species_id
        WHERE m.tree_id IN (${sql.join(
          existingTreeIds.map((id) => sql`${id}::uuid`),
          sql`, `
        )})
        ORDER BY m.tree_id, m.measured_at DESC
      `);
        for (const row of prev.rows) {
          previousByTree.set(row.tree_id, row);
        }
      }

      const speciesMap = await loadSpecies(db);
      const rules = (await getPublishedRules(db)).settings;
      const equations = await getEquations(db);

      const newTrees: (typeof tree.$inferInsert)[] = [];
      const newMeasurements: (typeof measurement.$inferInsert)[] = [];
      const newPhotos: (typeof measurementPhoto.$inferInsert)[] = [];
      const touchedPlots = new Set<number>();
      const perPlot = new Map<number, number>();
      /** Códigos ya medidos en este mismo envío. */
      const takenKeys = new Set<string>();

      const reject = (record: PushRecord, message: string) => {
        results.set(record.clientId, {
          clientId: record.clientId,
          message,
          status: "rejected",
        });
      };

      for (const record of records) {
        if (alreadySet.has(record.clientId)) {
          results.set(record.clientId, {
            clientId: record.clientId,
            status: "already",
          });
          continue;
        }
        const plotRow = plotByNumber.get(record.plotNumber);
        if (!plotRow) {
          reject(record, `La parcela P-${record.plotNumber} no existe`);
          continue;
        }
        if (ctx.role === "brigadista" && plotRow.brigadeId !== brigadeId) {
          reject(
            record,
            `P-${record.plotNumber} no está asignada a tu brigada`
          );
          continue;
        }
        if (plotRow.status === "locked" || plotRow.status === "unlocked") {
          reject(
            record,
            `P-${record.plotNumber} ya está cerrada: solo un administrador puede corregirla`
          );
          continue;
        }

        const { series } = CATEGORIES[record.category];
        const key = treeKey(record.plotNumber, series, record.code);
        let treeRow = treeByKey.get(key);
        const alreadyMeasured =
          takenKeys.has(key) ||
          (treeRow ? previousByTree.has(treeRow.id) : false);
        if (alreadyMeasured && !record.isRemeasure) {
          reject(
            record,
            `El código ${record.code} ya existe en P-${record.plotNumber}`
          );
          continue;
        }
        if (!treeRow) {
          treeRow = {
            category: record.category,
            code: record.code,
            createdAt: new Date(),
            id: crypto.randomUUID(),
            plotNumber: record.plotNumber,
            series,
            speciesId: record.speciesId,
          };
          treeByKey.set(key, treeRow);
          newTrees.push(treeRow);
        }

        if (record.health === null && healthRequired(record.category)) {
          reject(record, `Falta el estado sanitario del N° ${record.code}`);
          continue;
        }

        const metrics = deriveMetrics(record);
        const prevRow = previousByTree.get(treeRow.id);
        const gpsDistance =
          record.lat !== null &&
          record.lon !== null &&
          plotRow.lat !== null &&
          plotRow.lon !== null
            ? distanceMeters(
                { lat: record.lat, lon: record.lon },
                { lat: plotRow.lat, lon: plotRow.lon }
              )
            : null;
        const { alerts, carbon } = evaluateFields(
          {
            category: record.category,
            codeLabel: record.code,
            crownAvg: metrics.crownAvg,
            dacAvg: metrics.dacAvg,
            dapEq: metrics.dapEq,
            height: record.height,
            notes: record.notes,
            photoCount: record.photo ? 1 : 0,
            speciesId: record.speciesId,
          },
          { equations, rules, species: speciesMap },
          {
            gpsDistanceM: gpsDistance,
            previous: prevRow
              ? {
                  dapEq: prevRow.dap_eq,
                  speciesId: prevRow.species_id,
                  speciesName: prevRow.species_name ?? "",
                }
              : null,
          }
        );

        newMeasurements.push({
          accuracy: record.accuracy,
          alerts,
          brigadeId,
          carbonAerial: carbon.aerial,
          carbonRoot: carbon.root,
          carbonTotal: carbon.total,
          category: record.category,
          clino: record.clino,
          crownMax: record.crownMax,
          crownMin: record.crownMin,
          dac1: record.dac1,
          dac2: record.dac2,
          dapEq: metrics.dapEq,
          hasPhoto: record.photo !== null,
          health: record.health,
          height: record.height,
          heightMode: record.heightMode,
          id: record.clientId,
          isRemeasure: record.isRemeasure,
          lat: record.lat,
          lon: record.lon,
          measuredAt: new Date(record.measuredAt),
          notes: record.notes,
          plotNumber: record.plotNumber,
          review: initialReview(alerts, record.photo !== null),
          source: "field",
          speciesId: record.speciesId,
          stems: record.stems,
          treeId: treeRow.id,
          userId: ctx.actor.id,
        });
        if (record.photo) {
          newPhotos.push({
            data: record.photo.data,
            measurementId: record.clientId,
            mime: record.photo.mime,
          });
        }
        takenKeys.add(key);
        touchedPlots.add(record.plotNumber);
        perPlot.set(
          record.plotNumber,
          (perPlot.get(record.plotNumber) ?? 0) + 1
        );
        results.set(record.clientId, {
          clientId: record.clientId,
          status: "saved",
        });
      }

      // Un solo lote = una sola transacción: no quedan árboles huérfanos si algo falla.
      const statements: BatchItem<"pg">[] = [];
      if (newTrees.length > 0) {
        statements.push(db.insert(tree).values(newTrees));
      }
      if (newMeasurements.length > 0) {
        statements.push(
          db.insert(measurement).values(newMeasurements).onConflictDoNothing()
        );
      }
      for (let i = 0; i < newPhotos.length; i += PHOTO_INSERT_CHUNK) {
        statements.push(
          db
            .insert(measurementPhoto)
            .values(newPhotos.slice(i, i + PHOTO_INSERT_CHUNK))
        );
      }
      const [firstStatement, ...restStatements] = statements;
      if (firstStatement) {
        await db.batch([firstStatement, ...restStatements]);
      }
      if (touchedPlots.size > 0) {
        await refreshPlotStatuses(db, [...touchedPlots], "review");
        for (const [plotNumber, count] of perPlot) {
          // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
          await writeAudit(db, ctx.actor, {
            action: "sync",
            detail: { records: count },
            plotNumber,
          });
        }
      }

      return {
        results: records.map(
          (r) =>
            results.get(r.clientId) ?? {
              clientId: r.clientId,
              message: "No se procesó",
              status: "rejected" as const,
            }
        ),
      };
    }),
});
