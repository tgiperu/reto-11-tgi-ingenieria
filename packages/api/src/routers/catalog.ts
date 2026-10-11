import { user } from "@reto-11-tgi-ingenieria/db/schema/auth";
import {
  brigade,
  sector,
  species,
} from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  measurement,
  plot,
  tree,
} from "@reto-11-tgi-ingenieria/db/schema/inventory";
import {
  carbonOf,
  describeEquations,
  type EquationKey,
  type Equations,
} from "@reto-11-tgi-ingenieria/domain/carbon";
import {
  CATEGORY_LIST,
  type CategoryKey,
} from "@reto-11-tgi-ingenieria/domain/categories";
import {
  groupVariants,
  normalizeKey,
  tidy,
} from "@reto-11-tgi-ingenieria/domain/names";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router, staffProcedure } from "../index";
import { writeAudit } from "../lib/audit";
import { recomputeSpeciesStats } from "../lib/evaluation";
import {
  bumpCatalogVersion,
  getCatalogVersion,
  getEquations,
  getPublishedRules,
  saveEquations,
} from "../lib/settings";

const DEFAULT_K = 3;

/** El jefe de brigada debe ser un usuario registrado que aún no tenga brigada. */
async function loadFreeLeader(
  db: Parameters<typeof writeAudit>[0],
  userId: string,
  brigadeId: string | null
): Promise<{ id: string; name: string }> {
  const [row] = await db
    .select({ brigadeId: user.brigadeId, id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Usuario no encontrado",
    });
  }
  if (row.brigadeId !== null && row.brigadeId !== brigadeId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${row.name} ya pertenece a la brigada ${row.brigadeId}`,
    });
  }
  return { id: row.id, name: row.name };
}
const CARBON_CHUNK = 500;

const equationsSchema = z.object({
  arbusto: z.object({ a: z.number().positive(), b: z.number().positive() }),
  biomassToCarbon: z.number().positive().max(1),
  brinzal: z.object({ a: z.number().positive(), b: z.number() }),
  fustal: z.object({ c0: z.number(), c1: z.number(), c2: z.number() }),
  latizal: z.object({ a: z.number().positive(), b: z.number().positive() }),
  overo: z.object({ a: z.number().positive(), b: z.number().positive() }),
  rootRatioShrub: z.number().nonnegative().max(2),
  rootRatioTree: z.number().nonnegative().max(2),
}) satisfies z.ZodType<Equations>;

async function recomputeAllCarbon(
  db: Parameters<typeof recomputeSpeciesStats>[0],
  equations: Equations
): Promise<number> {
  const speciesRows = await db
    .select({ equationKey: species.equationKey, id: species.id })
    .from(species);
  const keyBySpecies = new Map(speciesRows.map((s) => [s.id, s.equationKey]));
  const rows = await db
    .select({
      category: measurement.category,
      crownMax: measurement.crownMax,
      crownMin: measurement.crownMin,
      dac1: measurement.dac1,
      dac2: measurement.dac2,
      dapEq: measurement.dapEq,
      id: measurement.id,
      speciesId: measurement.speciesId,
    })
    .from(measurement);
  for (let i = 0; i < rows.length; i += CARBON_CHUNK) {
    const slice = rows.slice(i, i + CARBON_CHUNK);
    const values = sql.join(
      slice.map((row) => {
        const crownAvg =
          row.crownMin !== null && row.crownMax !== null
            ? (row.crownMin + row.crownMax) / 2
            : (row.crownMin ?? row.crownMax);
        const dacAvg =
          row.dac1 !== null && row.dac2 !== null
            ? (row.dac1 + row.dac2) / 2
            : (row.dac1 ?? row.dac2);
        const c = carbonOf(
          {
            category: row.category as CategoryKey,
            crownAvg,
            dacAvg,
            dapEq: row.dapEq,
            equationKey: (row.speciesId === null
              ? null
              : (keyBySpecies.get(row.speciesId) ?? null)) as EquationKey,
          },
          equations
        );
        return sql`(${row.id}::uuid, ${c.aerial}::double precision, ${c.root}::double precision, ${c.total}::double precision)`;
      }),
      sql`, `
    );
    // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
    await db.execute(sql`
      UPDATE measurement AS m SET carbon_aerial = v.ca, carbon_root = v.cr, carbon_total = v.ct
      FROM (VALUES ${values}) AS v(id, ca, cr, ct) WHERE m.id = v.id
    `);
  }
  return rows.length;
}

export const catalogRouter = router({
  brigades: router({
    create: adminProcedure
      .input(
        z.object({
          id: z.string().trim().min(2).max(20),
          leaderUserId: z.string(),
          members: z.array(z.string().trim().min(1).max(120)).max(12),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = input.id.toUpperCase();
        const leader = await loadFreeLeader(ctx.db, input.leaderUserId, null);
        const [dup] = await ctx.db
          .select()
          .from(brigade)
          .where(eq(brigade.id, id))
          .limit(1);
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `La brigada ${id} ya existe`,
          });
        }
        await ctx.db
          .insert(brigade)
          .values({ id, leaderName: leader.name, members: input.members });
        await ctx.db
          .update(user)
          .set({ brigadeId: id })
          .where(eq(user.id, leader.id));
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "brigade.create",
          entity: "brigade",
          entityId: id,
        });
        return { id };
      }),

    list: staffProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db
        .select()
        .from(brigade)
        .orderBy(desc(brigade.createdAt), brigade.id);
      const plots = await ctx.db
        .select({
          brigadeId: plot.brigadeId,
          n: sql<number>`count(*)`.mapWith(Number),
        })
        .from(plot)
        .groupBy(plot.brigadeId);
      const syncs = await ctx.db
        .select({
          at: sql<string>`max(${measurement.syncedAt})`,
          brigadeId: measurement.brigadeId,
        })
        .from(measurement)
        .groupBy(measurement.brigadeId);
      const plotCount = new Map(plots.map((p) => [p.brigadeId, p.n]));
      const lastSync = new Map(syncs.map((s) => [s.brigadeId, s.at]));
      return rows.map((b) => ({
        devices: b.devices,
        id: b.id,
        lastSync: lastSync.get(b.id) ?? null,
        leaderName: b.leaderName,
        members: b.members,
        plots: plotCount.get(b.id) ?? 0,
      }));
    }),

    update: adminProcedure
      .input(
        z.object({
          devices: z.number().int().min(0).max(50).optional(),
          id: z.string(),
          leaderUserId: z.string().optional(),
          members: z
            .array(z.string().trim().min(1).max(120))
            .max(12)
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, leaderUserId, ...patch } = input;
        const set: Partial<typeof brigade.$inferInsert> = { ...patch };
        if (leaderUserId) {
          const [current] = await ctx.db
            .select()
            .from(brigade)
            .where(eq(brigade.id, id))
            .limit(1);
          const leader = await loadFreeLeader(ctx.db, leaderUserId, id);
          if (current && current.leaderName !== leader.name) {
            // El jefe anterior queda sin brigada y vuelve a estar disponible.
            await ctx.db
              .update(user)
              .set({ brigadeId: null })
              .where(
                and(eq(user.brigadeId, id), eq(user.name, current.leaderName))
              );
          }
          await ctx.db
            .update(user)
            .set({ brigadeId: id })
            .where(eq(user.id, leader.id));
          set.leaderName = leader.name;
        }
        await ctx.db.update(brigade).set(set).where(eq(brigade.id, id));
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "brigade.update",
          entity: "brigade",
          entityId: id,
        });
      }),
  }),

  categories: staffProcedure.query(async ({ ctx }) => {
    const equations = await getEquations(ctx.db);
    return {
      categories: CATEGORY_LIST,
      equations,
      formulas: describeEquations(equations),
    };
  }),

  equations: router({
    update: adminProcedure
      .input(equationsSchema)
      .mutation(async ({ ctx, input }) => {
        await saveEquations(ctx.db, input);
        const recomputed = await recomputeAllCarbon(ctx.db, input);
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "equations.update",
          detail: { recomputed },
          entity: "equations",
        });
        return { recomputed };
      }),
  }),

  sectors: router({
    create: adminProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120) }))
      .mutation(async ({ ctx, input }) => {
        const name = tidy(input.name);
        const rows = await ctx.db.select().from(sector);
        const key = normalizeKey(name);
        if (rows.some((s) => normalizeKey(s.name) === key)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `El sector "${name}" ya existe`,
          });
        }
        const [row] = await ctx.db.insert(sector).values({ name }).returning();
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "sector.create",
          entity: "sector",
          entityId: name,
        });
        return row;
      }),

    list: staffProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db
        .select()
        .from(sector)
        .orderBy(desc(sector.createdAt), desc(sector.id));
      const plots = await ctx.db
        .select({
          n: sql<number>`count(*)`.mapWith(Number),
          sectorId: plot.sectorId,
        })
        .from(plot)
        .groupBy(plot.sectorId);
      const records = await ctx.db
        .select({
          n: sql<number>`count(*)`.mapWith(Number),
          sectorId: plot.sectorId,
        })
        .from(measurement)
        .innerJoin(plot, eq(plot.number, measurement.plotNumber))
        .groupBy(plot.sectorId);
      const plotCount = new Map(plots.map((p) => [p.sectorId, p.n]));
      const recordCount = new Map(records.map((p) => [p.sectorId, p.n]));
      const sectors = rows.map((s) => ({
        id: s.id,
        name: s.name,
        plots: plotCount.get(s.id) ?? 0,
        records: recordCount.get(s.id) ?? 0,
        variants: s.variants,
      }));
      const groups = groupVariants(rows.map((r) => r.name)).filter(
        (g) => g.variants.length > 1
      );
      const byName = new Map(rows.map((r) => [r.name, r]));
      const suggestions = groups.map((g) => ({
        canonical: g.canonical,
        canonicalId: byName.get(g.canonical)?.id ?? null,
        mergeIds: g.variants
          .filter((v) => v !== g.canonical)
          .map((v) => byName.get(v)?.id)
          .filter((id): id is number => id !== undefined),
        records: g.variants.reduce(
          (acc, v) => acc + (recordCount.get(byName.get(v)?.id ?? -1) ?? 0),
          0
        ),
        variants: g.variants,
      }));
      return { sectors, suggestions };
    }),

    merge: adminProcedure
      .input(
        z.object({
          keepId: z.number().int(),
          mergeIds: z.array(z.number().int()).min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ids = input.mergeIds.filter((id) => id !== input.keepId);
        const merged = await ctx.db
          .select()
          .from(sector)
          .where(inArray(sector.id, ids));
        const [keep] = await ctx.db
          .select()
          .from(sector)
          .where(eq(sector.id, input.keepId))
          .limit(1);
        if (!keep) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sector no encontrado",
          });
        }
        await ctx.db
          .update(plot)
          .set({ sectorId: keep.id })
          .where(inArray(plot.sectorId, ids));
        const variants = [
          ...new Set([
            ...keep.variants,
            ...merged.map((m) => m.name),
            ...merged.flatMap((m) => m.variants),
          ]),
        ];
        await ctx.db
          .update(sector)
          .set({ variants })
          .where(eq(sector.id, keep.id));
        await ctx.db.delete(sector).where(inArray(sector.id, ids));
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "sector.merge",
          detail: { merged: merged.map((m) => m.name) },
          entity: "sector",
          entityId: keep.name,
        });
      }),
  }),

  species: router({
    create: adminProcedure
      .input(
        z.object({
          lifeForm: z.enum(["Árbol", "Arbusto", "Árbol / arbusto"]),
          name: z.string().trim().min(2).max(120),
          scientificName: z.string().trim().max(160).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const name = tidy(input.name);
        const rows = await ctx.db.select({ name: species.name }).from(species);
        const key = normalizeKey(name);
        if (rows.some((s) => normalizeKey(s.name) === key)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `La especie "${name}" ya existe`,
          });
        }
        const [row] = await ctx.db
          .insert(species)
          .values({
            equationKey: key === "overo" ? "overo" : null,
            isNN: key.startsWith("nn"),
            lifeForm: input.lifeForm,
            name,
            scientificName: input.scientificName || null,
          })
          .returning();
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "species.create",
          entity: "species",
          entityId: name,
        });
        return row;
      }),

    list: staffProcedure
      .input(z.object({ search: z.string().max(80).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const rows = await ctx.db.select().from(species);
        const counts = await ctx.db
          .select({
            id: measurement.speciesId,
            n: sql<number>`count(*)`.mapWith(Number),
          })
          .from(measurement)
          .groupBy(measurement.speciesId);
        const count = new Map(counts.map((c) => [c.id, c.n]));
        const created = new Map(rows.map((s) => [s.id, s.createdAt.getTime()]));
        const q = normalizeKey(input?.search ?? "");
        return rows
          .filter(
            (s) =>
              q === "" ||
              normalizeKey(s.name).includes(q) ||
              normalizeKey(s.scientificName ?? "").includes(q)
          )
          .map((s) => ({
            count: count.get(s.id) ?? 0,
            dapMax: s.dapMax,
            dapMean: s.dapMean,
            dapMin: s.dapMin,
            dapSd: s.dapSd,
            heightMax: s.heightMax,
            id: s.id,
            lifeForm: s.lifeForm,
            limitsManual: s.limitsManual,
            name: s.name,
            scientificName: s.scientificName,
          }))
          .sort(
            (a, b) =>
              (created.get(b.id) ?? 0) - (created.get(a.id) ?? 0) ||
              b.count - a.count ||
              a.name.localeCompare(b.name)
          );
      }),

    merge: adminProcedure
      .input(
        z.object({
          keepId: z.number().int(),
          mergeIds: z.array(z.number().int()).min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ids = input.mergeIds.filter((id) => id !== input.keepId);
        await ctx.db
          .update(tree)
          .set({ speciesId: input.keepId })
          .where(inArray(tree.speciesId, ids));
        await ctx.db
          .update(measurement)
          .set({ speciesId: input.keepId })
          .where(inArray(measurement.speciesId, ids));
        await ctx.db.delete(species).where(inArray(species.id, ids));
        const k =
          (await getPublishedRules(ctx.db)).settings.find(
            (s) => s.key === "dap"
          )?.param ?? DEFAULT_K;
        await recomputeSpeciesStats(ctx.db, k);
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "species.merge",
          detail: { merged: ids },
          entity: "species",
          entityId: String(input.keepId),
        });
      }),

    recompute: adminProcedure.mutation(async ({ ctx }) => {
      const k =
        (await getPublishedRules(ctx.db)).settings.find((s) => s.key === "dap")
          ?.param ?? DEFAULT_K;
      await recomputeSpeciesStats(ctx.db, k);
      await bumpCatalogVersion(ctx.db);
      await writeAudit(ctx.db, ctx.actor, {
        action: "species.recompute",
        entity: "species",
      });
    }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          lifeForm: z.enum(["Árbol", "Arbusto", "Árbol / arbusto"]).optional(),
          name: z.string().trim().min(2).max(120).optional(),
          scientificName: z.string().trim().max(160).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...patch } = input;
        await ctx.db.update(species).set(patch).where(eq(species.id, id));
        await bumpCatalogVersion(ctx.db);
        await writeAudit(ctx.db, ctx.actor, {
          action: "species.update",
          entity: "species",
          entityId: String(id),
        });
      }),
  }),

  version: staffProcedure.query(({ ctx }) => getCatalogVersion(ctx.db)),
});
