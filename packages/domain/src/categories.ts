export const CATEGORY_KEYS = ["la", "fu", "ar", "br"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** Los árboles (latizal alto y fustal) comparten la misma serie de códigos de placa. */
export type CodeSeries = "arbol" | "arbusto" | "brinzal";

export interface CategoryDef {
  criterion: string;
  key: CategoryKey;
  name: string;
  radiusM: number;
  series: CodeSeries;
  variable: string;
}

export const FUSTAL_MIN_DIAMETER_CM = 63;
export const SEEDLING_MAX_DIAMETER_CM = 5;

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  ar: {
    criterion: "Diámetro de copa ≥ 40 cm",
    key: "ar",
    name: "Arbusto grande",
    radiusM: 20,
    series: "arbusto",
    variable: "Diámetro de copa",
  },
  br: {
    criterion: "DAP < 5 cm",
    key: "br",
    name: "Brinzal",
    radiusM: 10,
    series: "brinzal",
    variable: "DAC (2 lecturas)",
  },
  fu: {
    criterion: "DAP ≥ 63 cm (árbol)",
    key: "fu",
    name: "Fustal",
    radiusM: 30,
    series: "arbol",
    variable: "DAP / D. equivalente",
  },
  la: {
    criterion: "Árbol, DAP < 63 cm",
    key: "la",
    name: "Latizal alto",
    radiusM: 30,
    series: "arbol",
    variable: "DAP / D. equivalente",
  },
};

export const CATEGORY_LIST = CATEGORY_KEYS.map((key) => CATEGORIES[key]);

const SQUARE_METERS_PER_HECTARE = 10_000;

/** FE = 1 / área de la subparcela (ha). */
export function expansionFactor(radiusM: number): number {
  return SQUARE_METERS_PER_HECTARE / (Math.PI * radiusM * radiusM);
}

export function categoryFactor(key: CategoryKey): number {
  return expansionFactor(CATEGORIES[key].radiusM);
}

export function isTreeCategory(key: CategoryKey): boolean {
  return key === "la" || key === "fu";
}

const COMBINING_MARKS = /[̀-ͯ]/g;

export function parseCategoryKey(value: string): CategoryKey | null {
  const norm = value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim();
  if (norm.startsWith("latizal")) {
    return "la";
  }
  if (norm.startsWith("fustal")) {
    return "fu";
  }
  if (norm.startsWith("arbusto")) {
    return "ar";
  }
  if (norm.startsWith("brinzal")) {
    return "br";
  }
  return null;
}
