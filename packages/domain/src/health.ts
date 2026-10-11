import type { CategoryKey } from "./categories";

export const HEALTH_KEYS = ["sano", "danado", "quemado", "muerto_pie"] as const;
export type HealthKey = (typeof HEALTH_KEYS)[number];

export const HEALTH_LABELS: Record<HealthKey, string> = {
  danado: "Dañado o con plagas",
  muerto_pie: "Muerto en pie",
  quemado: "Quemado",
  sano: "Sano",
};

export const HEALTH_LIST = HEALTH_KEYS.map((key) => ({
  key,
  name: HEALTH_LABELS[key],
}));

/** La ficha de brinzal (subparcela de 10 m) no registra estado sanitario. */
export function healthRequired(category: CategoryKey): boolean {
  return category !== "br";
}

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Reconoce las variantes escritas a mano en el Excel: «Quemado», «quemados», «muerto en pie»… */
export function parseHealth(value: string): HealthKey | null {
  const norm = value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim();
  if (norm === "") {
    return null;
  }
  if (norm.startsWith("sano") || norm === "bueno") {
    return "sano";
  }
  if (norm.startsWith("quemad")) {
    return "quemado";
  }
  if (norm.startsWith("muert") || norm.startsWith("seco")) {
    return "muerto_pie";
  }
  if (
    norm.startsWith("dana") ||
    norm.startsWith("plaga") ||
    norm.startsWith("enferm")
  ) {
    return "danado";
  }
  return null;
}

export function healthLabel(value: string | null | undefined): string {
  return value && value in HEALTH_LABELS
    ? HEALTH_LABELS[value as HealthKey]
    : "—";
}
