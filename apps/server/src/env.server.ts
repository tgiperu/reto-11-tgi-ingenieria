import type { CoercedEnvSchema } from "./env";

const REQUIRED_KEYS = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "CORS_ORIGIN",
  "DATABASE_URL",
] as const;

/**
 * En Vercel las variables ya vienen inyectadas en `process.env` y el binario de `varlock`
 * no existe en la función, así que se leen directamente. En local y Docker se usa varlock.
 */
function readProcessEnv(): Readonly<CoercedEnvSchema> {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }
  return process.env as unknown as Readonly<CoercedEnvSchema>;
}

async function loadEnv(): Promise<Readonly<CoercedEnvSchema>> {
  if (process.env.VERCEL) {
    return readProcessEnv();
  }
  await import("varlock/auto-load");
  const { ENV: varlockEnv } = await import("./env");
  return varlockEnv;
}

export const ENV = await loadEnv();
