import type { Session } from "@reto-11-tgi-ingenieria/auth";
import type { Database } from "@reto-11-tgi-ingenieria/db";

export type Context = {
  session: Session | null;
  db: Database;
};
