import { z } from "zod";

import {
  CATEGORIES,
  CATEGORY_KEYS,
  type CategoryKey,
  FUSTAL_MIN_DIAMETER_CM,
  parseCategoryKey,
  SEEDLING_MAX_DIAMETER_CM,
} from "./categories";
import { HEALTH_KEYS, parseHealth } from "./health";
import { equivalentDiameter, parseDecimal } from "./measure";
import {
  groupVariants,
  isValidTime,
  normalizeKey,
  normalizeTime,
  tidy,
  type VariantGroup,
} from "./names";

export const IMPORT_FIELDS = [
  {
    aliases: [
      "n de parcela",
      "numero de parcela",
      "nro de parcela",
      "parcela",
      "n parcela",
      "plot",
    ],
    key: "plot",
    label: "N° de parcela",
    required: true,
    target: "parcela.numero",
  },
  {
    aliases: ["sector", "localidad", "lugar"],
    key: "sector",
    label: "Sector",
    required: true,
    target: "sector.nombre (catálogo)",
  },
  {
    aliases: ["estrato", "tipo de bosque", "estrato de bosque"],
    key: "stratum",
    label: "Estrato",
    required: false,
    target: "parcela.estrato",
  },
  {
    aliases: ["anp", "area natural protegida", "area"],
    key: "anp",
    label: "Área natural protegida",
    required: false,
    target: "parcela.anp",
  },
  {
    aliases: ["categoria", "categoria de individuo", "tipo de individuo"],
    key: "category",
    label: "Categoría",
    required: true,
    target: "individuo.categoria",
  },
  {
    aliases: [
      "n",
      "n de placa",
      "placa",
      "codigo",
      "numero de arbol",
      "n de arbol",
      "nº",
    ],
    key: "code",
    label: "N° de placa",
    required: true,
    target: "individuo.codigo + eje",
  },
  {
    aliases: [
      "especie",
      "nombre comun",
      "especie nombre comun",
      "nombre vernacular",
    ],
    key: "species",
    label: "Especie",
    required: true,
    target: "individuo.especie",
  },
  {
    aliases: ["dap cm", "dap", "diametro", "dap a 1 30 m"],
    key: "dap",
    label: "DAP (cm)",
    required: false,
    target: "eje.dap_cm",
  },
  {
    aliases: ["altura total m", "altura total", "altura m", "altura", "h m"],
    key: "height",
    label: "Altura (m)",
    required: false,
    target: "individuo.altura_m",
  },
  {
    aliases: ["diametro de copa menor", "copa menor", "dc menor"],
    key: "crownMin",
    label: "Copa menor (m)",
    required: false,
    target: "individuo.copa_menor_m",
  },
  {
    aliases: ["diametro de copa mayor", "copa mayor", "dc mayor"],
    key: "crownMax",
    label: "Copa mayor (m)",
    required: false,
    target: "individuo.copa_mayor_m",
  },
  {
    aliases: ["dac 1", "dac1", "dac lectura 1"],
    key: "dac1",
    label: "DAC lectura 1 (cm)",
    required: false,
    target: "individuo.dac1_cm",
  },
  {
    aliases: ["dac 2", "dac2", "dac lectura 2"],
    key: "dac2",
    label: "DAC lectura 2 (cm)",
    required: false,
    target: "individuo.dac2_cm",
  },
  {
    aliases: ["fecha", "fecha de evaluacion", "fecha de medicion"],
    key: "date",
    label: "Fecha",
    required: false,
    target: "evaluacion.fecha",
  },
  {
    aliases: ["hora inicio", "hora de inicio", "hora inicial"],
    key: "timeStart",
    label: "Hora de inicio",
    required: false,
    target: "evaluacion.hora_inicio",
  },
  {
    aliases: ["hora final", "hora fin", "hora de fin", "hora termino"],
    key: "timeEnd",
    label: "Hora final",
    required: false,
    target: "evaluacion.hora_fin",
  },
  {
    aliases: ["brigada", "codigo de brigada"],
    key: "brigade",
    label: "Brigada",
    required: false,
    target: "brigada.codigo",
  },
  {
    aliases: [
      "coordenada este",
      "este",
      "utm e",
      "utm este",
      "x",
      "coordenada x",
    ],
    key: "utmE",
    label: "Coord. Este (campo)",
    required: false,
    target: "parcela.utm_este (campo)",
  },
  {
    aliases: [
      "coordenada norte",
      "norte",
      "utm n",
      "utm norte",
      "y",
      "coordenada y",
    ],
    key: "utmN",
    label: "Coord. Norte (campo)",
    required: false,
    target: "parcela.utm_norte (campo)",
  },
  {
    aliases: ["este gabinete", "coordenada este gabinete", "x gabinete"],
    key: "cabE",
    label: "Coord. Este (gabinete)",
    required: false,
    target: "parcela.gabinete_este",
  },
  {
    aliases: ["norte gabinete", "coordenada norte gabinete", "y gabinete"],
    key: "cabN",
    label: "Coord. Norte (gabinete)",
    required: false,
    target: "parcela.gabinete_norte",
  },
  {
    aliases: ["estado sanitario", "sanidad", "estado fitosanitario"],
    key: "health",
    label: "Estado sanitario",
    required: false,
    target: "individuo.estado_sanitario",
  },
  {
    aliases: ["observaciones", "observacion", "comentarios"],
    key: "notes",
    label: "Observaciones",
    required: false,
    target: "individuo.observaciones",
  },
  {
    aliases: ["reservorio de carbono total", "carbono total", "carbono"],
    key: "carbon",
    label: "Reservorio de carbono total",
    required: false,
    target: "(calculado por el sistema)",
  },
] as const;

export type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export const IMPORT_FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key) as FieldKey[];
export type Mapping = Partial<Record<FieldKey, number>>;

const FIELD_BY_KEY = new Map(IMPORT_FIELDS.map((f) => [f.key, f]));

export function importFieldLabel(key: FieldKey): string {
  return FIELD_BY_KEY.get(key)?.label ?? key;
}

/** Propone qué columna del archivo alimenta cada campo del sistema. */
export function autoMap(headers: readonly string[]): Mapping {
  const keys = headers.map((h) => normalizeKey(String(h ?? "")));
  const mapping: Mapping = {};
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    let index = keys.findIndex(
      (k, i) => !used.has(i) && field.aliases.includes(k as never)
    );
    if (index < 0) {
      index = keys.findIndex(
        (k, i) =>
          !used.has(i) &&
          k.length > 3 &&
          field.aliases.some((a) => a.length > 3 && k.includes(a))
      );
    }
    if (index >= 0) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

export const importRecordSchema = z.object({
  anp: z.string().max(20).nullable(),
  brigade: z.string().max(40).nullable(),
  cabE: z.number().nullable(),
  cabN: z.number().nullable(),
  category: z.enum(CATEGORY_KEYS),
  code: z.string().regex(/^\d{1,6}$/),
  crownMax: z.number().nonnegative().nullable(),
  crownMin: z.number().nonnegative().nullable(),
  dac1: z.number().nonnegative().nullable(),
  dac2: z.number().nonnegative().nullable(),
  date: z.string().nullable(),
  health: z.enum(HEALTH_KEYS).nullable(),
  height: z.number().nonnegative().max(80).nullable(),
  notes: z.string().max(2000),
  plot: z.number().int().positive(),
  sector: z.string().min(1).max(120),
  species: z.string().min(1).max(120),
  stems: z.array(z.number().positive().max(500)).max(40),
  stratum: z.string().max(60).nullable(),
  timeEnd: z.string().nullable(),
  timeStart: z.string().nullable(),
  utmE: z.number().nullable(),
  utmN: z.number().nullable(),
});
export type ImportRecord = z.infer<typeof importRecordSchema>;

export type IssueLevel = "error" | "warning";
export interface ImportIssue {
  field: FieldKey | null;
  level: IssueLevel;
  message: string;
  row: number;
}

export interface ExistingCatalogs {
  sectors: readonly string[];
  species: readonly string[];
}

export interface FieldSummary {
  column: number | null;
  errors: number;
  example: string;
  key: FieldKey;
  note: string;
  warnings: number;
}

export interface ImportPreview {
  blockedRows: number;
  fields: FieldSummary[];
  issues: ImportIssue[];
  newSectors: string[];
  newSpecies: string[];
  records: ImportRecord[];
  sectorVariants: VariantGroup[];
  speciesVariants: VariantGroup[];
  totalRows: number;
  validRows: number;
  warningRows: number;
}

const CODE_PATTERN = /^(?:[a-z]+-?)?(\d+)(?:\.(\d+))?$/i;
const DATE_DMY = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const MAX_SHRUB_HEIGHT_FOR_INFERENCE = 80;

export function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return tidy(String(value));
}

function cellNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  return parseDecimal(cellText(value));
}

export function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  const iso = text.match(DATE_ISO);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const dmy = text.match(DATE_DMY);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }
  return null;
}

function inferCategory(
  dap: number | null,
  crown: number | null,
  dac: number | null
): CategoryKey | null {
  if (dac !== null && (dap === null || dap < SEEDLING_MAX_DIAMETER_CM)) {
    return "br";
  }
  if (dap !== null) {
    return dap >= FUSTAL_MIN_DIAMETER_CM ? "fu" : "la";
  }
  if (crown !== null) {
    return "ar";
  }
  return null;
}

interface RowCtx {
  grid: readonly (readonly unknown[])[];
  mapping: Mapping;
}

function pick(ctx: RowCtx, row: number, key: FieldKey): unknown {
  const col = ctx.mapping[key];
  if (col === undefined) {
    return null;
  }
  return ctx.grid[row]?.[col] ?? null;
}

interface Draft {
  axes: Map<number, number>;
  record: ImportRecord;
  rows: number[];
}

function matchCatalog(
  value: string,
  catalog: ReadonlyMap<string, string>
): string {
  return catalog.get(normalizeKey(value)) ?? value;
}

/** Construye la vista previa: normaliza, agrupa ejes por árbol y valida cada fila. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
export function buildImportPreview(
  grid: readonly (readonly unknown[])[],
  mapping: Mapping,
  existing: ExistingCatalogs
): ImportPreview {
  const ctx: RowCtx = { grid, mapping };
  const dataRows = grid.length > 0 ? grid.length - 1 : 0;
  const issues: ImportIssue[] = [];
  const add = (
    row: number,
    level: IssueLevel,
    field: FieldKey | null,
    message: string
  ) => issues.push({ field, level, message, row });

  const sectorValues: string[] = [];
  const speciesValues: string[] = [];
  for (let r = 1; r <= dataRows; r += 1) {
    sectorValues.push(cellText(pick(ctx, r, "sector")));
    speciesValues.push(cellText(pick(ctx, r, "species")));
  }
  const sectorGroups = groupVariants(sectorValues);
  const speciesGroups = groupVariants(speciesValues);
  const sectorCanon = new Map<string, string>();
  const speciesCanon = new Map<string, string>();
  for (const name of existing.sectors) {
    sectorCanon.set(normalizeKey(name), name);
  }
  for (const name of existing.species) {
    speciesCanon.set(normalizeKey(name), name);
  }
  for (const g of sectorGroups) {
    if (!sectorCanon.has(normalizeKey(g.canonical))) {
      sectorCanon.set(normalizeKey(g.canonical), g.canonical);
    }
  }
  for (const g of speciesGroups) {
    if (!speciesCanon.has(normalizeKey(g.canonical))) {
      speciesCanon.set(normalizeKey(g.canonical), g.canonical);
    }
  }

  const drafts = new Map<string, Draft>();
  for (let r = 1; r <= dataRows; r += 1) {
    const plotRaw = cellNumber(pick(ctx, r, "plot"));
    if (plotRaw === null || !Number.isInteger(plotRaw) || plotRaw <= 0) {
      add(r, "error", "plot", "N° de parcela vacío o inválido");
      continue;
    }
    const sectorRaw = cellText(pick(ctx, r, "sector"));
    if (sectorRaw === "") {
      add(r, "error", "sector", "Sector vacío");
      continue;
    }
    const codeRaw = cellText(pick(ctx, r, "code"));
    const codeMatch = codeRaw.match(CODE_PATTERN);
    if (!codeMatch?.[1]) {
      add(r, "error", "code", `Código "${codeRaw}" inválido`);
      continue;
    }
    const base = String(Number.parseInt(codeMatch[1], 10));
    const axis = codeMatch[2] ? Number.parseInt(codeMatch[2], 10) : 1;

    const dap = cellNumber(pick(ctx, r, "dap"));
    const crownMin = cellNumber(pick(ctx, r, "crownMin"));
    const crownMax = cellNumber(pick(ctx, r, "crownMax"));
    const dac1 = cellNumber(pick(ctx, r, "dac1"));
    const dac2 = cellNumber(pick(ctx, r, "dac2"));
    const crownAvg =
      crownMin !== null && crownMax !== null
        ? (crownMin + crownMax) / 2
        : (crownMax ?? crownMin);

    const catRaw = cellText(pick(ctx, r, "category"));
    let category = parseCategoryKey(catRaw);
    if (!category) {
      category = inferCategory(dap, crownAvg, dac1 ?? dac2);
      if (!category) {
        add(
          r,
          "error",
          "category",
          `Categoría "${catRaw}" fuera de catálogo y sin datos para inferirla`
        );
        continue;
      }
      add(
        r,
        "warning",
        "category",
        `Categoría "${catRaw}" fuera de catálogo · se infiere ${CATEGORIES[category].name}`
      );
    }

    const speciesRaw = cellText(pick(ctx, r, "species"));
    if (speciesRaw === "") {
      add(r, "error", "species", "Especie vacía (usa NN si no se identificó)");
      continue;
    }

    const key = `${plotRaw}|${CATEGORIES[category].series}|${base}`;
    const existingDraft = drafts.get(key);
    if (existingDraft) {
      if (existingDraft.axes.has(axis)) {
        add(
          r,
          "error",
          "code",
          `Código ${base}.${axis} duplicado en la parcela ${plotRaw}`
        );
        continue;
      }
      if (dap !== null) {
        existingDraft.record.stems.push(dap);
        existingDraft.axes.set(axis, dap);
      }
      const height = cellNumber(pick(ctx, r, "height"));
      if (height !== null && height > (existingDraft.record.height ?? 0)) {
        existingDraft.record.height = height;
      }
      existingDraft.rows.push(r);
      continue;
    }

    const timeStartRaw = cellText(pick(ctx, r, "timeStart"));
    const timeEndRaw = cellText(pick(ctx, r, "timeEnd"));
    const timeStart = timeStartRaw === "" ? null : normalizeTime(timeStartRaw);
    const timeEnd = timeEndRaw === "" ? null : normalizeTime(timeEndRaw);
    for (const [raw, norm, field] of [
      [timeStartRaw, timeStart, "timeStart"],
      [timeEndRaw, timeEnd, "timeEnd"],
    ] as const) {
      if (raw !== "" && norm === null) {
        add(r, "warning", field, `Hora "${raw}" con formato inválido`);
      } else if (raw !== "" && !isValidTime(raw)) {
        add(r, "warning", field, `Hora "${raw}" se corrige a ${norm}`);
      }
    }
    if (timeStart && timeEnd && timeEnd <= timeStart) {
      add(r, "warning", "timeEnd", "La hora final no es mayor que la inicial");
    }

    const dateRaw = pick(ctx, r, "date");
    const date = parseDate(dateRaw);
    if (cellText(dateRaw) !== "" && date === null) {
      add(r, "warning", "date", `Fecha "${cellText(dateRaw)}" no reconocida`);
    }

    const sector = matchCatalog(sectorRaw, sectorCanon);
    if (sector !== sectorRaw) {
      add(r, "warning", "sector", `"${sectorRaw}" se normaliza a "${sector}"`);
    }
    const species = matchCatalog(speciesRaw, speciesCanon);

    const stems = dap !== null && dap > 0 ? [dap] : [];
    if (category === "la" || category === "fu") {
      if (stems.length === 0) {
        add(r, "error", "dap", "Árbol sin DAP");
        continue;
      }
    } else if (category === "ar" && crownAvg === null) {
      add(r, "error", "crownMax", "Arbusto sin diámetro de copa");
      continue;
    } else if (category === "br" && dac1 === null && dac2 === null) {
      add(r, "error", "dac1", "Brinzal sin lectura de DAC");
      continue;
    }

    const healthRaw = cellText(pick(ctx, r, "health"));
    const health = parseHealth(healthRaw);
    if (healthRaw !== "" && health === null) {
      add(
        r,
        "warning",
        "health",
        `Estado sanitario "${healthRaw}" no reconocido`
      );
    }

    const brigadeRaw = cellText(pick(ctx, r, "brigade"));
    const stratumRaw = cellText(pick(ctx, r, "stratum"));
    const anpRaw = cellText(pick(ctx, r, "anp")).toUpperCase();
    const record: ImportRecord = {
      anp: anpRaw === "" ? null : anpRaw.slice(0, 20),
      brigade: brigadeRaw === "" ? null : brigadeRaw,
      cabE: cellNumber(pick(ctx, r, "cabE")),
      cabN: cellNumber(pick(ctx, r, "cabN")),
      category,
      code: base,
      crownMax,
      crownMin,
      dac1,
      dac2,
      date,
      health,
      height: cellNumber(pick(ctx, r, "height")),
      notes: cellText(pick(ctx, r, "notes")),
      plot: plotRaw,
      sector,
      species,
      stems,
      stratum: stratumRaw === "" ? null : stratumRaw,
      timeEnd,
      timeStart,
      utmE: cellNumber(pick(ctx, r, "utmE")),
      utmN: cellNumber(pick(ctx, r, "utmN")),
    };
    drafts.set(key, { axes: new Map([[axis, dap ?? 0]]), record, rows: [r] });
  }

  const records = [...drafts.values()].map((d) => d.record);
  for (const draft of drafts.values()) {
    const { record } = draft;
    const row = draft.rows[0] ?? 0;
    if (record.category === "br") {
      const dac =
        ((record.dac1 ?? record.dac2 ?? 0) +
          (record.dac2 ?? record.dac1 ?? 0)) /
        2;
      if (dac < 0.4) {
        add(
          row,
          "warning",
          "dac1",
          "DAC < 0.4 cm: el carbono sería negativo · se marca para revisión"
        );
      }
    }
    if (
      record.height !== null &&
      record.height > MAX_SHRUB_HEIGHT_FOR_INFERENCE
    ) {
      add(
        row,
        "warning",
        "height",
        `Altura de ${record.height} m poco creíble`
      );
    }
    const eq = equivalentDiameter(record.stems);
    if (record.category === "la" && eq >= FUSTAL_MIN_DIAMETER_CM) {
      add(
        row,
        "warning",
        "category",
        "Latizal con DAP ≥ 63 cm · debería ser Fustal"
      );
    }
    if (record.category === "fu" && eq > 0 && eq < FUSTAL_MIN_DIAMETER_CM) {
      add(
        row,
        "warning",
        "category",
        "Fustal con DAP < 63 cm · debería ser Latizal alto"
      );
    }
  }

  const blocked = new Set(
    issues.filter((i) => i.level === "error").map((i) => i.row)
  );
  const warned = new Set(
    issues
      .filter((i) => i.level === "warning" && !blocked.has(i.row))
      .map((i) => i.row)
  );
  const existingSectorKeys = new Set(existing.sectors.map(normalizeKey));
  const existingSpeciesKeys = new Set(existing.species.map(normalizeKey));
  const newSectors = [...new Set(records.map((r) => r.sector))].filter(
    (s) => !existingSectorKeys.has(normalizeKey(s))
  );
  const newSpecies = [...new Set(records.map((r) => r.species))].filter(
    (s) => !existingSpeciesKeys.has(normalizeKey(s))
  );

  const fields: FieldSummary[] = IMPORT_FIELDS.filter(
    (f) => mapping[f.key] !== undefined
  ).map((f) => {
    const column = mapping[f.key] ?? null;
    const own = issues.filter((i) => i.field === f.key);
    const errors = own.filter((i) => i.level === "error").length;
    const warnings = own.length - errors;
    return {
      column,
      errors,
      example: column === null ? "" : cellText(grid[1]?.[column]),
      key: f.key,
      note: own[0]?.message ?? "",
      warnings,
    };
  });

  return {
    blockedRows: blocked.size,
    fields,
    issues,
    newSectors,
    newSpecies,
    records,
    sectorVariants: sectorGroups.filter((g) => g.variants.length > 1),
    speciesVariants: speciesGroups.filter((g) => g.variants.length > 1),
    totalRows: dataRows,
    validRows: dataRows - blocked.size - warned.size,
    warningRows: warned.size,
  };
}

export const IMPORT_TEMPLATE_HEADERS = IMPORT_FIELDS.filter(
  (f) => f.key !== "carbon"
).map((f) => f.label);
