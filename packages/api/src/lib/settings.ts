import type { Database } from "@reto-11-tgi-ingenieria/db";
import { appSetting } from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  ruleRelease,
  ruleSetting,
} from "@reto-11-tgi-ingenieria/db/schema/inventory";
import {
  DEFAULT_EQUATIONS,
  type Equations,
} from "@reto-11-tgi-ingenieria/domain/carbon";
import {
  defaultRuleSettings,
  isCustomKey,
  RULE_KEYS,
  type RuleSetting,
} from "@reto-11-tgi-ingenieria/domain/rules";
import { desc, eq } from "drizzle-orm";

const CATALOG_VERSION_KEY = "catalogVersion";
const EQUATIONS_KEY = "equations";

export async function getSetting<T>(
  db: Database,
  key: string,
  fallback: T
): Promise<T> {
  const [row] = await db
    .select()
    .from(appSetting)
    .where(eq(appSetting.key, key))
    .limit(1);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(
  db: Database,
  key: string,
  value: unknown
): Promise<void> {
  await db
    .insert(appSetting)
    .values({ key, value })
    .onConflictDoUpdate({ set: { value }, target: appSetting.key });
}

export function getCatalogVersion(db: Database): Promise<number> {
  return getSetting(db, CATALOG_VERSION_KEY, 1);
}

export async function bumpCatalogVersion(db: Database): Promise<number> {
  const next = (await getCatalogVersion(db)) + 1;
  await setSetting(db, CATALOG_VERSION_KEY, next);
  return next;
}

export async function getEquations(db: Database): Promise<Equations> {
  const stored = await getSetting<Partial<Equations>>(db, EQUATIONS_KEY, {});
  return { ...DEFAULT_EQUATIONS, ...stored };
}

export async function saveEquations(
  db: Database,
  equations: Equations
): Promise<void> {
  await setSetting(db, EQUATIONS_KEY, equations);
}

/** Reglas en edición (borrador): lo que ve el administrador antes de publicar. */
export async function getDraftRules(db: Database): Promise<RuleSetting[]> {
  const rows = await db.select().from(ruleSetting);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const builtIn = defaultRuleSettings().map((base) => {
    const row = byKey.get(base.key);
    return row ? { active: row.active, key: base.key, param: row.param } : base;
  });
  const custom = rows
    .filter((r) => isCustomKey(r.key) && r.custom)
    .map(
      (r): RuleSetting => ({
        active: r.active,
        custom: r.custom,
        key: r.key as RuleSetting["key"],
        param: r.param,
      })
    );
  return [...builtIn, ...custom];
}

export function ruleVersionLabel(id: number): string {
  return `v1.${id}`;
}

export interface PublishedRules {
  id: number;
  label: string;
  settings: RuleSetting[];
}

/** Reglas publicadas: las que descargan los equipos y evalúa el servidor. */
export async function getPublishedRules(db: Database): Promise<PublishedRules> {
  const [row] = await db
    .select()
    .from(ruleRelease)
    .orderBy(desc(ruleRelease.id))
    .limit(1);
  if (!row) {
    return { id: 0, label: "sin publicar", settings: defaultRuleSettings() };
  }
  const known = new Set<string>(RULE_KEYS);
  const settings = row.settings.filter(
    (s) => known.has(s.key) || (isCustomKey(s.key) && s.custom)
  );
  const have = new Set(settings.map((s) => s.key));
  for (const base of defaultRuleSettings()) {
    if (!have.has(base.key)) {
      settings.push(base);
    }
  }
  return { id: row.id, label: ruleVersionLabel(row.id), settings };
}
