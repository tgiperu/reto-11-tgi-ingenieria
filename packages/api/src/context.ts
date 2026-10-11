import type { Session } from "@reto-11-tgi-ingenieria/auth";
import type { Database } from "@reto-11-tgi-ingenieria/db";

// biome-ignore lint/style/useConsistentTypeDefinitions: el adaptador de tRPC exige un tipo con firma de índice implícita
export type Context = {
  db: Database;
  session: Session | null;
};
