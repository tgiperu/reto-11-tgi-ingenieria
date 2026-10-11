import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const brigade = pgTable("brigade", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  devices: integer("devices").notNull().default(0),
  /** Código visible: BR-01, BR-02… */
  id: text("id").primaryKey(),
  leaderName: text("leader_name").notNull(),
  members: jsonb("members").$type<string[]>().notNull().default([]),
});

export const sector = pgTable("sector", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  /** Otras escrituras del mismo sector, ya fusionadas. */
  variants: jsonb("variants").$type<string[]>().notNull().default([]),
});

export const species = pgTable("species", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dapMax: doublePrecision("dap_max"),
  dapMean: doublePrecision("dap_mean"),
  /** Límites efectivos que usan las alertas (calculados o fijados a mano). */
  dapMin: doublePrecision("dap_min"),
  dapSd: doublePrecision("dap_sd"),
  /** `overo` usa su propia ecuación de arbusto. */
  equationKey: text("equation_key"),
  heightMax: doublePrecision("height_max"),
  heightMean: doublePrecision("height_mean"),
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  isNN: boolean("is_nn").notNull().default(false),
  lifeForm: text("life_form").notNull().default("Árbol"),
  limitsManual: boolean("limits_manual").notNull().default(false),
  name: text("name").notNull().unique(),
  sampleSize: integer("sample_size").notNull().default(0),
  scientificName: text("scientific_name"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** Valores sueltos de configuración: versión de catálogos, ecuaciones de carbono… */
export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  value: jsonb("value").$type<unknown>().notNull(),
});
