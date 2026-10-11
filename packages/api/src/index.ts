import type { Role } from "@reto-11-tgi-ingenieria/domain/constants";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const { router } = t;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      cause: "No session",
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

function roleOf(value: string | null | undefined): Role {
  return value === "admin" || value === "supervisor" ? value : "brigadista";
}

export const roleProcedure = (...allowed: Role[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    const role = roleOf(ctx.session.user.role);
    if (!allowed.includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No tienes permiso para esta acción",
      });
    }
    return next({
      ctx: {
        ...ctx,
        actor: { id: ctx.session.user.id, name: ctx.session.user.name },
        role,
      },
    });
  });

/** Supervisor o administrador: escritorio de gestión. */
export const staffProcedure = roleProcedure("admin", "supervisor");

/** Solo administrador: catálogos, reglas, correcciones. */
export const adminProcedure = roleProcedure("admin");

/** Cualquier usuario con sesión, con su rol resuelto. */
export const memberProcedure = roleProcedure(
  "admin",
  "supervisor",
  "brigadista"
);
