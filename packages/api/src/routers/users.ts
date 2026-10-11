import { hashPassword } from "@reto-11-tgi-ingenieria/auth/password";
import { account, appRole, user } from "@reto-11-tgi-ingenieria/db/schema/auth";
import { brigade } from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  ROLE_LABELS,
  ROLES,
  type Role,
} from "@reto-11-tgi-ingenieria/domain/constants";
import { normalizeKey, tidy } from "@reto-11-tgi-ingenieria/domain/names";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router } from "../index";
import { writeAudit } from "../lib/audit";

type Db = Parameters<typeof writeAudit>[0];

const ACCESS = z.enum(ROLES);
const MIN_PASSWORD = 8;

/** Los tres roles de fábrica existen siempre; los demás los crea el administrador. */
async function ensureSystemRoles(db: Db): Promise<void> {
  await db
    .insert(appRole)
    .values(
      ROLES.map((id) => ({
        access: id,
        id,
        name: ROLE_LABELS[id],
        system: true,
      }))
    )
    .onConflictDoNothing();
}

async function findRole(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(appRole)
    .where(eq(appRole.id, id))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Rol no encontrado" });
  }
  return row;
}

function assertEmailFree(taken: boolean): void {
  if (taken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Ya existe un usuario con ese correo",
    });
  }
}

const rolesRouter = router({
  create: adminProcedure
    .input(z.object({ access: ACCESS, name: z.string().trim().min(2).max(60) }))
    .mutation(async ({ ctx, input }) => {
      await ensureSystemRoles(ctx.db);
      const name = tidy(input.name);
      const existing = await ctx.db.select().from(appRole);
      if (existing.some((r) => normalizeKey(r.name) === normalizeKey(name))) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `El rol "${name}" ya existe`,
        });
      }
      const id = `rol-${crypto.randomUUID().slice(0, 8)}`;
      await ctx.db
        .insert(appRole)
        .values({ access: input.access, id, name, system: false });
      await writeAudit(ctx.db, ctx.actor, {
        action: "role.create",
        detail: { access: input.access, name },
        entity: "role",
        entityId: id,
      });
      return { id };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await findRole(ctx.db, input.id);
      if (role.system) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Los roles de fábrica no se pueden eliminar",
        });
      }
      const [inUse] = (
        await ctx.db.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM "user" WHERE role_id = ${input.id}`
        )
      ).rows;
      if ((inUse?.n ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Hay usuarios con este rol: cámbialos antes de eliminarlo",
        });
      }
      await ctx.db.delete(appRole).where(eq(appRole.id, input.id));
      await writeAudit(ctx.db, ctx.actor, {
        action: "role.delete",
        entity: "role",
        entityId: input.id,
      });
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    await ensureSystemRoles(ctx.db);
    const roles = await ctx.db.select().from(appRole);
    const counts = await ctx.db.execute<{ n: number; role_key: string }>(sql`
      SELECT coalesce(role_id, role) AS role_key, count(*)::int AS n
      FROM "user" GROUP BY 1
    `);
    const byRole = new Map(counts.rows.map((r) => [r.role_key, r.n]));
    return roles
      .map((r) => ({
        access: r.access as Role,
        accessLabel: ROLE_LABELS[r.access as Role] ?? r.access,
        createdAt: r.createdAt.getTime(),
        id: r.id,
        name: r.name,
        system: r.system,
        users: byRole.get(r.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          Number(b.system) - Number(a.system) || b.createdAt - a.createdAt
      );
  }),

  update: adminProcedure
    .input(
      z.object({
        access: ACCESS,
        id: z.string(),
        name: z.string().trim().min(2).max(60),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = await findRole(ctx.db, input.id);
      if (role.system) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Los roles de fábrica no se pueden modificar",
        });
      }
      const name = tidy(input.name);
      const others = (await ctx.db.select().from(appRole)).filter(
        (r) => r.id !== input.id
      );
      if (others.some((r) => normalizeKey(r.name) === normalizeKey(name))) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `El rol "${name}" ya existe`,
        });
      }
      await ctx.db
        .update(appRole)
        .set({ access: input.access, name })
        .where(eq(appRole.id, input.id));
      // Quien tenga este rol recibe el nivel de acceso actualizado.
      await ctx.db
        .update(user)
        .set({ role: input.access })
        .where(eq(user.roleId, input.id));
      await writeAudit(ctx.db, ctx.actor, {
        action: "role.update",
        detail: { access: input.access, name },
        entity: "role",
        entityId: input.id,
      });
    }),
});

const usersRouter = router({
  /** Usuarios sin brigada (más los de la brigada indicada): candidatos a jefe de brigada. */
  available: adminProcedure
    .input(z.object({ brigadeId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          brigadeId: user.brigadeId,
          email: user.email,
          id: user.id,
          name: user.name,
        })
        .from(user)
        .orderBy(user.name);
      return rows
        .filter(
          (r) =>
            r.brigadeId === null ||
            (input.brigadeId !== null && r.brigadeId === input.brigadeId)
        )
        .map((r) => ({ email: r.email, id: r.id, name: r.name }));
    }),

  create: adminProcedure
    .input(
      z.object({
        brigadeId: z.string().nullable(),
        email: z.string().trim().toLowerCase().email().max(160),
        name: z.string().trim().min(2).max(120),
        password: z.string().min(MIN_PASSWORD).max(128),
        roleId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureSystemRoles(ctx.db);
      const role = await findRole(ctx.db, input.roleId);
      const [taken] = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1);
      assertEmailFree(Boolean(taken));
      const id = crypto.randomUUID();
      const password = await hashPassword(input.password);
      await ctx.db.insert(user).values({
        brigadeId: input.brigadeId,
        email: input.email,
        emailVerified: true,
        id,
        name: tidy(input.name),
        role: role.access,
        roleId: role.id,
      });
      await ctx.db.insert(account).values({
        accountId: id,
        id: crypto.randomUUID(),
        password,
        providerId: "credential",
        userId: id,
      });
      await writeAudit(ctx.db, ctx.actor, {
        action: "user.create",
        detail: { email: input.email, role: role.name },
        entity: "user",
        entityId: id,
      });
      return { id };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    await ensureSystemRoles(ctx.db);
    const rows = await ctx.db
      .select({
        access: user.role,
        brigadeId: user.brigadeId,
        brigadeLeader: brigade.leaderName,
        createdAt: user.createdAt,
        email: user.email,
        id: user.id,
        name: user.name,
        roleId: user.roleId,
        roleName: appRole.name,
      })
      .from(user)
      .leftJoin(brigade, eq(brigade.id, user.brigadeId))
      .leftJoin(appRole, eq(appRole.id, user.roleId))
      .orderBy(desc(user.createdAt), user.name);
    return rows.map((r) => ({
      access: r.access as Role,
      brigadeId: r.brigadeId,
      brigadeLeader: r.brigadeLeader,
      createdAt: r.createdAt.toISOString(),
      email: r.email,
      id: r.id,
      name: r.name,
      // Cuentas anteriores a los roles: se muestran con el rol de fábrica de su acceso.
      roleId: r.roleId ?? r.access,
      roleName: r.roleName ?? ROLE_LABELS[r.access as Role] ?? r.access,
    }));
  }),

  update: adminProcedure
    .input(
      z.object({
        brigadeId: z.string().nullable(),
        id: z.string(),
        name: z.string().trim().min(2).max(120),
        password: z.string().min(MIN_PASSWORD).max(128).optional(),
        roleId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureSystemRoles(ctx.db);
      const role = await findRole(ctx.db, input.roleId);
      if (input.id === ctx.actor.id && role.access !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes quitarte a ti mismo el acceso de administrador",
        });
      }
      const result = await ctx.db
        .update(user)
        .set({
          brigadeId: input.brigadeId,
          name: tidy(input.name),
          role: role.access,
          roleId: role.id,
        })
        .where(eq(user.id, input.id))
        .returning({ id: user.id });
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado",
        });
      }
      if (input.password) {
        await ctx.db
          .update(account)
          .set({ password: await hashPassword(input.password) })
          .where(eq(account.userId, input.id));
      }
      await writeAudit(ctx.db, ctx.actor, {
        action: "user.update",
        detail: { passwordChanged: Boolean(input.password), role: role.name },
        entity: "user",
        entityId: input.id,
      });
    }),
});

export const accessRouter = router({ roles: rolesRouter, users: usersRouter });
