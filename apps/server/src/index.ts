import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@reto-11-tgi-ingenieria/api/routers/index";
import { initLogger } from "evlog";
import {
  type BetterAuthInstance,
  createAuthMiddleware,
} from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { auth } from "./services";

initLogger({
  env: { service: "reto-11-tgi-ingenieria-server" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

const app = new Hono<EvlogVariables>();

app.use(
  evlog({
    drain: process.env.NODE_ENV === "production" ? undefined : createFsDrain(),
  })
);
app.use("*", async (c, next) => {
  await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
  await next();
});

app.use(
  "/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    origin: ENV.CORS_ORIGIN.split(",").map((o) => o.trim()),
  })
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

app.use(
  "/api/trpc/*",
  trpcServer({
    createContext: (_opts, context) => createContext({ context }),
    endpoint: "/api/trpc",
    router: appRouter,
  })
);

app.get("/", (c) => c.text("OK"));

export default app;
