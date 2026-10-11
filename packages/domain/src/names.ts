const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_ALNUM = /[^a-z0-9ñ]+/g;
const WHITESPACE = /\s+/g;
const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const LOOSE_TIME_PATTERN = /^(\d{1,2})\s*:\s*(\d{2})\s*(a m|p m|am|pm)?$/;
const DOTS = /\./g;
const NOON = 12;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;

/** Clave de comparación: sin tildes, en minúsculas, sin signos ni espacios repetidos. */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(NON_ALNUM, " ")
    .trim();
}

export function tidy(value: string): string {
  return value.replace(WHITESPACE, " ").trim();
}

function capitalCount(value: string): number {
  let count = 0;
  for (const ch of value) {
    if (ch !== ch.toLowerCase()) {
      count += 1;
    }
  }
  return count;
}

export interface VariantGroup {
  canonical: string;
  count: number;
  variants: string[];
}

/** Agrupa nombres que solo difieren en tildes, mayúsculas o espacios y elige el valor canónico. */
export function groupVariants(values: Iterable<string>): VariantGroup[] {
  const buckets = new Map<string, Map<string, number>>();
  for (const raw of values) {
    const value = tidy(raw);
    if (value === "") {
      continue;
    }
    const key = normalizeKey(value);
    const bucket = buckets.get(key) ?? new Map<string, number>();
    bucket.set(value, (bucket.get(value) ?? 0) + 1);
    buckets.set(key, bucket);
  }
  const groups: VariantGroup[] = [];
  for (const bucket of buckets.values()) {
    const entries = [...bucket.entries()].sort(
      (a, b) =>
        b[1] - a[1] ||
        capitalCount(b[0]) - capitalCount(a[0]) ||
        a[0].localeCompare(b[0])
    );
    const [first] = entries;
    if (!first) {
      continue;
    }
    groups.push({
      canonical: first[0],
      count: entries.reduce((acc, [, n]) => acc + n, 0),
      variants: entries.map(([name]) => name),
    });
  }
  return groups.sort((a, b) => a.canonical.localeCompare(b.canonical));
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value.trim());
}

/** Convierte "11: 10 a. m." / "2:05 p. m." / "11:10" a "HH:MM". Devuelve null si no se puede. */
export function normalizeTime(value: string): string | null {
  const text = value
    .trim()
    .toLowerCase()
    .replace(DOTS, "")
    .replace(WHITESPACE, " ");
  const match = text.match(LOOSE_TIME_PATTERN);
  if (!match) {
    return null;
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.replace(" ", "");
  if (meridiem === "pm" && hours < NOON) {
    hours += NOON;
  }
  if (meridiem === "am" && hours === NOON) {
    hours = 0;
  }
  if (hours > LAST_HOUR || minutes > LAST_MINUTE) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
