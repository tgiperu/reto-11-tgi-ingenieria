import type { createAuth } from "@reto-11-tgi-ingenieria/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "../env";
import { resolveServerUrl } from "./server-url";

function getServerUrl(url: string) {
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  if (typeof window === "undefined" && processEnv?.SERVER_URL) {
    return processEnv.SERVER_URL.endsWith("/")
      ? processEnv.SERVER_URL.slice(0, -1)
      : processEnv.SERVER_URL;
  }

  const resolved = resolveServerUrl(url);
  return resolved.endsWith("/") ? resolved.slice(0, -1) : resolved;
}

export const authClient = createAuthClient({
  baseURL: new URL("/api/auth", getServerUrl(ENV.VITE_SERVER_URL)).toString(),
  plugins: [inferAdditionalFields<ReturnType<typeof createAuth>>()],
});
