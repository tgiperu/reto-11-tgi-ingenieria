import { brigade } from "@reto-11-tgi-ingenieria/db/schema/catalog";
import { eq } from "drizzle-orm";

import { memberProcedure, publicProcedure, router } from "../index";
import { alertsRouter } from "./alerts";
import { catalogRouter } from "./catalog";
import { dashboardRouter } from "./dashboard";
import { importsRouter } from "./imports";
import { plotsRouter } from "./plots";
import { syncRouter } from "./sync";

export const appRouter = router({
  alerts: alertsRouter,
  catalog: catalogRouter,
  dashboard: dashboardRouter,
  healthCheck: publicProcedure.query(() => "OK"),
  imports: importsRouter,
  me: memberProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const [brigadeRow] = user.brigadeId
      ? await ctx.db
          .select()
          .from(brigade)
          .where(eq(brigade.id, user.brigadeId))
          .limit(1)
      : [];
    return {
      brigade: brigadeRow
        ? { id: brigadeRow.id, leaderName: brigadeRow.leaderName }
        : null,
      email: user.email,
      id: user.id,
      name: user.name,
      role: ctx.role,
    };
  }),
  plots: plotsRouter,
  sync: syncRouter,
});
export type AppRouter = typeof appRouter;
