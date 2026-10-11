const MS_PER_DAY = 86_400_000;
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;
const DAYS_IN_WEEK = 7;

export function monthName(index: number): string {
  return MONTH_NAMES[index] ?? "";
}

export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIso(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d ?? 1, month: (m ?? 1) - 1, year: y ?? 1970 };
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function dayDiff(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      MS_PER_DAY
  );
}

export function todayLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date()
  );
}

export interface CalendarCell {
  day: number | null;
  iso: string | null;
  weekend: boolean;
}

/** Semanas de lunes a domingo; las celdas vacías llevan `iso: null`. */
export function monthCells(year: number, month: number): CalendarCell[] {
  const first =
    (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % DAYS_IN_WEEK;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < first; i += 1) {
    cells.push({ day: null, iso: null, weekend: false });
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push({
      day,
      iso: isoOf(year, month, day),
      weekend: (first + day - 1) % DAYS_IN_WEEK >= 5,
    });
  }
  return cells;
}
