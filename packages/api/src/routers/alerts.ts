import { species } from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  ruleRelease,
  ruleSetting,
} from "@reto-11-tgi-ingenieria/db/schema/inventory";
import type { CategoryKey } from "@reto-11-tgi-ingenieria/domain/categories";
import {
  evaluateMeasurement,
  RULE_KEYS,
  RULE_LIST,
  type RuleKey,
  type RuleSetting,
} from "@reto-11-tgi-ingenieria/domain/rules";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router, staffProcedure } from "../index";
import { writeAudit } from "../lib/audit";
import {
  CONTEXT_RULES,
  loadSpecies,
  recomputeSpeciesStats,
  reevaluateMeasurements,
  refreshPlotStatuses,
} from "../lib/evaluation";
import {
  bumpCatalogVersion,
  getDraftRules,
  getEquations,
  getPublishedRules,
} from "../lib/settings";

const DEFAULT_K = 3;
const RULE_KEY_ENUM = z.enum(RULE_KEYS);

// biome-ignore lint/style/useConsistentTypeDefinitions: db.execute exige tipos con firma de índice implícita
type HitRow = {
  n: number;
  rule: string;
};

async function hitCounts(
  db: Parameters<typeof loadSpecies>[0]
): Promise<Map<string, number>> {
  const result = await db.execute<HitRow>(sql`
    SELECT r->>'rule' AS rule, count(*)::int AS n
    FROM measurement m, jsonb_array_elements(m.alerts) AS r
    GROUP BY 1
  `);
  return new Map(result.rows.map((r) => [r.rule, r.n]));
}

function sameSettings(
  a: readonly RuleSetting[],
  b: readonly RuleSetting[]
): boolean {
  return RULE_KEYS.every((key) => {
    const x = a.find((s) => s.key === key);
    const y = b.find((s) => s.key === key);
    return x?.active === y?.active && x?.param === y?.param;
  });
}

export const alertsRouter = router({
  range: router({
    get: staffProcedure
      .input(z.object({ speciesId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const [row] = await ctx.db
          .select()
          .from(species)
          .where(eq(species.id, input.speciesId))
          .limit(1);
        if (!row) {
          return null;
        }
        return {
          dapMax: row.dapMax,
          dapMean: row.dapMean,
          dapMin: row.dapMin,
          dapSd: row.dapSd,
          heightMax: row.heightMax,
          heightMean: row.heightMean,
          id: row.id,
          manual: row.limitsManual,
          name: row.name,
          sample: row.sampleSize,
        };
      }),

    reset: adminProcedure
      .input(z.object({ speciesId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .update(species)
          .set({ limitsManual: false })
          .where(eq(species.id, input.speciesId));
        const published = await getPublishedRules(ctx.db);
        const k =
          published.settings.find((s) => s.key === "dap")?.param ?? DEFAULT_K;
        await recomputeSpeciesStats(ctx.db, k);
        const ctxEval = {
          equations: await getEquations(ctx.db),
          rules: published.settings,
          species: await loadSpecies(ctx.db),
        };
        await reevaluateMeasurements(
          ctx.db,
          ctxEval,
          sql`m.species_id = ${input.speciesId}`
        );
        await bumpCatalogVersion(ctx.db);
      }),

    update: adminProcedure
      .input(
        z.object({
          dapMax: z.number().positive().max(500).nullable(),
          dapMin: z.number().nonnegative().max(500).nullable(),
          heightMax: z.number().positive().max(80).nullable(),
          speciesId: z.number().int(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .update(species)
          .set({
            dapMax: input.dapMax,
            dapMin: input.dapMin,
            heightMax: input.heightMax,
            limitsManual: true,
          })
          .where(eq(species.id, input.speciesId));
        const published = await getPublishedRules(ctx.db);
        const ctxEval = {
          equations: await getEquations(ctx.db),
          rules: published.settings,
          species: await loadSpecies(ctx.db),
        };
        const touched = await reevaluateMeasurements(
          ctx.db,
          ctxEval,
          sql`m.species_id = ${input.speciesId}`
        );
        await refreshPlotStatuses(ctx.db, null, "review");
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "species.range",
          detail: {
            dapMax: input.dapMax,
            heightMax: input.heightMax,
            reevaluated: touched,
          },
          entity: "species",
          entityId: String(input.speciesId),
        });
      }),
  }),

  rules: router({
    list: staffProcedure.query(async ({ ctx }) => {
      const { db } = ctx;
      const draft = await getDraftRules(db);
      const published = await getPublishedRules(db);
      const hits = await hitCounts(db);
      const coord = draft.find((s) => s.key === "coord");
      const [coordHits] = (
        await db.execute<{ n: number }>(sql`
          SELECT count(*)::int AS n FROM plot WHERE deviation_m > ${coord?.param ?? 100}
        `)
      ).rows;
      return {
        activeCount: draft.filter((s) => s.active).length,
        dirty: !sameSettings(draft, published.settings),
        rules: RULE_LIST.map((meta) => {
          const setting = draft.find((s) => s.key === meta.key);
          return {
            ...meta,
            active: setting?.active ?? true,
            hits:
              meta.key === "coord"
                ? (coordHits?.n ?? 0)
                : (hits.get(meta.key) ?? 0),
            hitsUnit: meta.key === "coord" ? "parcelas" : "",
            param: setting?.param ?? null,
          };
        }),
        version: published.label,
      };
    }),

    publish: adminProcedure.mutation(async ({ ctx }) => {
      const { db } = ctx;
      const draft = await getDraftRules(db);
      const [release] = await db
        .insert(ruleRelease)
        .values({ publishedBy: ctx.actor.name, settings: draft })
        .returning();
      const k = draft.find((s) => s.key === "dap")?.param ?? DEFAULT_K;
      await recomputeSpeciesStats(db, k);
      const reevaluated = await reevaluateMeasurements(
        db,
        {
          equations: await getEquations(db),
          rules: draft,
          species: await loadSpecies(db),
        },
        sql`true`
      );
      await refreshPlotStatuses(db, null, "review");
      await bumpCatalogVersion(db);
      await writeAudit(db, ctx.actor, {
        action: "rules.publish",
        detail: { reevaluated, release: release?.id },
        entity: "rules",
      });
      return { reevaluated, release: release?.id ?? 0 };
    }),

    /** Prueba el borrador contra todas las mediciones históricas sin guardar nada. */
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
    test: adminProcedure.mutation(async ({ ctx }) => {
      const { db } = ctx;
      const draft = await getDraftRules(db);
      const speciesMap = await loadSpecies(db);
      const rows = await db.execute<{
        category: string;
        species_id: number | null;
        dap_eq: number | null;
        height: number | null;
        crown_min: number | null;
        crown_max: number | null;
        dac1: number | null;
        dac2: number | null;
        notes: string;
        has_photo: boolean;
        code: string;
      }>(sql`
        SELECT m.category, m.species_id, m.dap_eq, m.height, m.crown_min, m.crown_max, m.dac1, m.dac2,
               m.notes, m.has_photo, t.code
        FROM measurement m JOIN tree t ON t.id = m.tree_id
      `);
      const hits: Record<string, number> = {};
      for (const row of rows.rows) {
        const sp =
          row.species_id === null ? undefined : speciesMap.get(row.species_id);
        const crownAvg =
          row.crown_min !== null && row.crown_max !== null
            ? (row.crown_min + row.crown_max) / 2
            : (row.crown_min ?? row.crown_max);
        const dacAvg =
          row.dac1 !== null && row.dac2 !== null
            ? (row.dac1 + row.dac2) / 2
            : (row.dac1 ?? row.dac2);
        const alerts = evaluateMeasurement(
          {
            category: row.category as CategoryKey,
            codeLabel: row.code,
            crownAvg,
            dacAvg,
            dapEq: row.dap_eq,
            duplicate: false,
            gpsDistanceM: null,
            height: row.height,
            notes: row.notes,
            photoCount: row.has_photo ? 1 : 0,
            previous: null,
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
          draft
        );
        for (const a of alerts) {
          hits[a.rule] = (hits[a.rule] ?? 0) + 1;
        }
      }
      // Las reglas de contexto no se pueden probar sobre datos históricos: se informan con lo guardado.
      const stored = await hitCounts(db);
      for (const key of CONTEXT_RULES) {
        hits[key] = stored.get(key) ?? 0;
      }
      const coord = draft.find((s) => s.key === "coord");
      const [coordHits] = (
        await db.execute<{ n: number }>(sql`
          SELECT count(*)::int AS n FROM plot WHERE deviation_m > ${coord?.param ?? 100}
        `)
      ).rows;
      hits.coord = coordHits?.n ?? 0;
      return { evaluated: rows.rows.length, hits };
    }),

    update: adminProcedure
      .input(
        z.object({
          active: z.boolean().optional(),
          key: RULE_KEY_ENUM,
          param: z.number().nonnegative().max(100_000).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const draft = await getDraftRules(ctx.db);
        const current = draft.find((s) => s.key === input.key);
        const active = input.active ?? current?.active ?? true;
        const param =
          input.param === undefined ? (current?.param ?? null) : input.param;
        await ctx.db
          .insert(ruleSetting)
          .values({ active, key: input.key, param })
          .onConflictDoUpdate({
            set: { active, param },
            target: ruleSetting.key,
          });
        await writeAudit(ctx.db, ctx.actor, {
          action: "rules.update",
          detail: { active, key: input.key as RuleKey, param },
          entity: "rule",
          entityId: input.key,
        });
      }),
  }),
});
