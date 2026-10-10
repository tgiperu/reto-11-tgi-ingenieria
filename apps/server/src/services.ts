import { createAuth } from "@reto-11-tgi-ingenieria/auth";
import { createDb } from "@reto-11-tgi-ingenieria/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
