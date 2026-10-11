const PERCENT = 100;

export function parseDecimal(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = value.trim().replace(",", ".");
  if (cleaned === "") {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Diámetro equivalente de un árbol con varios ejes: √(Σ d²). */
export function equivalentDiameter(stems: readonly number[]): number {
  const sum = stems.reduce((acc, d) => (d > 0 ? acc + d * d : acc), 0);
  return Math.sqrt(sum);
}

export function average(
  values: ReadonlyArray<number | null | undefined>
): number | null {
  const valid = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((acc, v) => acc + v, 0) / valid.length;
}

/** Altura con clinómetro en porcentaje: distancia · (%copa − %base) / 100. */
export function clinometerHeight(
  distanceM: number,
  pctBase: number,
  pctTop: number
): number {
  return (distanceM * (pctTop - pctBase)) / PERCENT;
}

export function formatNumber(
  value: number | null | undefined,
  digits = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

/** Siguiente código libre de una serie, a partir de los códigos numéricos existentes. */
export function nextFreeCode(codes: Iterable<string>): string {
  let max = 0;
  for (const code of codes) {
    const n = Number.parseInt(code, 10);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  return String(max + 1);
}

export interface MetricsInput {
  crownMax: number | null;
  crownMin: number | null;
  dac1: number | null;
  dac2: number | null;
  stems: readonly number[];
}

export interface Metrics {
  crownAvg: number | null;
  dacAvg: number | null;
  dapEq: number | null;
}

/** Valores derivados de las mediciones crudas: D. equivalente, copa y DAC promedio. */
export function deriveMetrics(input: MetricsInput): Metrics {
  const valid = input.stems.filter((d) => d > 0);
  return {
    crownAvg: average([input.crownMin, input.crownMax]),
    dacAvg: average([input.dac1, input.dac2]),
    dapEq: valid.length > 0 ? equivalentDiameter(valid) : null,
  };
}

/** Tope duro de una altura de árbol: por encima es casi seguro un error de digitación. */
export const MAX_HEIGHT_M = 50;

/** Mensaje si la altura no es válida (≤ 0 o sobre el tope), `null` si está bien o vacía. */
export function heightError(height: number | null): string | null {
  if (height === null) {
    return null;
  }
  if (height <= 0) {
    return "La altura debe ser mayor que 0 m.";
  }
  if (height > MAX_HEIGHT_M) {
    return `La altura no puede superar ${MAX_HEIGHT_M} m: revisa el valor.`;
  }
  return null;
}

/** Deja solo dígitos y un separador decimal (sin signo): para campos que nunca son negativos. */
export function sanitizePositiveDecimal(value: string): string {
  const cleaned = value.replace(/[^0-9.,]/g, "");
  const first = cleaned.search(/[.,]/);
  if (first === -1) {
    return cleaned;
  }
  return `${cleaned.slice(0, first + 1)}${cleaned.slice(first + 1).replace(/[.,]/g, "")}`;
}
