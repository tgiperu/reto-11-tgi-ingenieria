const LOCALE = "es-PE";
const TZ = "America/Lima";

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: TZ,
  year: "numeric",
});
const timeSeconds = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
  timeZone: TZ,
});
const timeShort = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: TZ,
});
const SPACES = /\s/g;
const time12 = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: true,
  minute: "2-digit",
  timeZone: TZ,
});
const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  timeZone: TZ,
  year: "numeric",
});

export function fmtDateTime(value: string | Date | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function fmtTimeSeconds(
  value: string | Date | null | undefined
): string {
  return value ? timeSeconds.format(new Date(value)) : "—";
}

export function fmtTime(value: string | Date | null | undefined): string {
  return value ? timeShort.format(new Date(value)) : "—";
}

/** Hora en formato de 12 horas: 02:09 am / 02:09 pm. */
export function fmtTimeAmPm(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  return time12.format(new Date(value)).toLowerCase().replace(SPACES, " ");
}

export function fmtDate(value: string | Date | null | undefined): string {
  return value ? dateOnly.format(new Date(value)) : "—";
}

/** 2024-10-18 → 18/10/2024, sin pasar por zonas horarias. */
export function fmtIsoDay(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtInt(value: number): string {
  return value.toLocaleString("en-US");
}

export function fmtNum(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
}

export function longClock(now: Date): string {
  const date = new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(now);
  const text = `${date} · ${time}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function shortClock(now: Date): string {
  const date = new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: TZ,
    weekday: "short",
  }).format(now);
  const time = new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(now);
  const text = `${date} · ${time}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
