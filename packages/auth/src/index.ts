import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import type { Database } from "@reto-11-tgi-ingenieria/db";
import * as schema from "@reto-11-tgi-ingenieria/db/schema/auth";
import { betterAuth } from "better-auth";

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = []
) {
  const isHttps = env.BETTER_AUTH_URL.startsWith("https://");
  return betterAuth({
    advanced: {
      // Sin HTTPS (desarrollo en red local) el navegador descarta las cookies `Secure`.
      defaultCookieAttributes: isHttps
        ? { httpOnly: true, sameSite: "none", secure: true }
        : { httpOnly: true, sameSite: "lax", secure: false },
    },
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    // Las cuentas las crea un administrador (ver `bun run db:seed`): no hay registro público.
    emailAndPassword: { disableSignUp: true, enabled: true },
    plugins: [expo()],
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      ...env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      ...desktopOrigins,
      "reto-11-tgi-ingenieria://",
      "exp://",
      "http://localhost:8081",
    ],
    user: {
      additionalFields: {
        brigadeId: { input: false, required: false, type: "string" },
        role: {
          defaultValue: "brigadista",
          input: false,
          required: false,
          type: "string",
        },
      },
    },
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
