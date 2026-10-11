import type {
  RuleAlert,
  RuleSetting,
} from "@reto-11-tgi-ingenieria/domain/rules";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { brigade, sector, species } from "./catalog";

export const plot = pgTable(
  "plot",
  {
    anp: text("anp"),
    brigadeId: text("brigade_id").references(() => brigade.id),
    cabE: doublePrecision("cab_e"),
    cabN: doublePrecision("cab_n"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    crew: text("crew"),
    deviationM: doublePrecision("deviation_m"),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    number: integer("number").primaryKey(),
    sampleDate: date("sample_date", { mode: "string" }),
    sectorId: integer("sector_id")
      .notNull()
      .references(() => sector.id),
    status: text("status").notNull().default("assigned"),
    stratum: text("stratum").notNull(),
    timeEnd: text("time_end"),
    timeStart: text("time_start"),
    /** Coordenadas UTM 17S de campo y de gabinete (planificadas). */
    utmE: doublePrecision("utm_e"),
    utmN: doublePrecision("utm_n"),
  },
  (t) => [
    index("plot_brigade_idx").on(t.brigadeId),
    index("plot_sector_idx").on(t.sectorId),
  ]
);

export const tree = pgTable(
  "tree",
  {
    category: text("category").notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    plotNumber: integer("plot_number")
      .notNull()
      .references(() => plot.number),
    /** arbol | arbusto | brinzal: la serie en la que se numeran las placas. */
    series: text("series").notNull(),
    speciesId: integer("species_id").references(() => species.id),
  },
  (t) => [
    uniqueIndex("tree_plot_series_code_uq").on(t.plotNumber, t.series, t.code),
    index("tree_species_idx").on(t.speciesId),
  ]
);

export const measurement = pgTable(
  "measurement",
  {
    accuracy: doublePrecision("accuracy"),
    alerts: jsonb("alerts").$type<RuleAlert[]>().notNull().default([]),
    brigadeId: text("brigade_id"),
    carbonAerial: doublePrecision("carbon_aerial"),
    carbonRoot: doublePrecision("carbon_root"),
    carbonTotal: doublePrecision("carbon_total"),
    category: text("category").notNull(),
    clino: jsonb("clino").$type<{
      distance: number;
      pctBase: number;
      pctTop: number;
    } | null>(),
    crownMax: doublePrecision("crown_max"),
    crownMin: doublePrecision("crown_min"),
    dac1: doublePrecision("dac1"),
    dac2: doublePrecision("dac2"),
    dapEq: doublePrecision("dap_eq"),
    hasPhoto: boolean("has_photo").notNull().default(false),
    health: text("health"),
    height: doublePrecision("height"),
    heightMode: text("height_mode").notNull().default("direct"),
    id: uuid("id").primaryKey().defaultRandom(),
    isRemeasure: boolean("is_remeasure").notNull().default(false),
    lat: doublePrecision("lat"),
    locked: boolean("locked").notNull().default(true),
    lon: doublePrecision("lon"),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    notes: text("notes").notNull().default(""),
    plotNumber: integer("plot_number")
      .notNull()
      .references(() => plot.number),
    review: text("review").notNull().default("none"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    source: text("source").notNull().default("field"),
    speciesId: integer("species_id").references(() => species.id),
    stems: jsonb("stems").$type<number[]>().notNull().default([]),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => tree.id),
    userId: text("user_id"),
  },
  (t) => [
    index("measurement_plot_idx").on(t.plotNumber),
    index("measurement_tree_idx").on(t.treeId),
    index("measurement_measured_idx").on(t.measuredAt),
    index("measurement_review_idx").on(t.review),
    index("measurement_species_idx").on(t.speciesId),
  ]
);

export const measurementPhoto = pgTable("measurement_photo", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** JPEG/WebP en base64. Una foto cuesta ~300 KB tras comprimirla en el equipo. */
  data: text("data").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  measurementId: uuid("measurement_id")
    .notNull()
    .references(() => measurement.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
});

export const ruleSetting = pgTable("rule_setting", {
  active: boolean("active").notNull().default(true),
  key: text("key").primaryKey(),
  param: doublePrecision("param"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const ruleRelease = pgTable("rule_release", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  publishedBy: text("published_by"),
  settings: jsonb("settings").$type<RuleSetting[]>().notNull(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    action: text("action").notNull(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
    entity: text("entity"),
    entityId: text("entity_id"),
    id: uuid("id").primaryKey().defaultRandom(),
    plotNumber: integer("plot_number"),
    reason: text("reason"),
    userId: text("user_id"),
    userName: text("user_name"),
  },
  (t) => [
    index("audit_plot_idx").on(t.plotNumber),
    index("audit_at_idx").on(t.at),
  ]
);

export const importBatch = pgTable("import_batch", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  fileName: text("file_name").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  records: integer("records").notNull().default(0),
  rows: integer("rows").notNull().default(0),
  summary: jsonb("summary").$type<Record<string, unknown>>(),
});
