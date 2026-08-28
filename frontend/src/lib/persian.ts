/**
 * Persian formatting primitives.
 * ============================================================================
 * This module exists because Persian number, price and time formatting was
 * previously re-implemented ad hoc in ~20 components, with three different and
 * mutually inconsistent results:
 *
 *   - `toLocaleString("fa-IR")` scattered across every card (correct, but
 *     repeated, and impossible to change centrally)
 *   - `CountdownTimer` rendering `03:41:22` in Latin digits, LTR, monospace,
 *     inside an RTL Persian interface
 *   - The same countdown collapsing "۱ روز و ۲۳ ساعت" down to just "۱ روز",
 *     which understates the remaining time by almost a full day
 *
 * Everything here is pure and framework-free so it is safe in both server and
 * client components.
 */

/* ---------------------------------------------------------------------------
 * Numbers
 * ------------------------------------------------------------------------- */

const faGrouped = new Intl.NumberFormat("fa-IR");
const faPlain = new Intl.NumberFormat("fa-IR", { useGrouping: false });

/** Persian digits with thousands separators. `1250000` → `«۱٬۲۵۰٬۰۰۰»` */
export function faNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return faGrouped.format(0);
  }
  return faGrouped.format(Number(value));
}

/** Persian digits, no separators. For counters, quantities, clock segments. */
export function faDigits(value: number | null | undefined, minDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return faPlain.format(0);
  }
  return new Intl.NumberFormat("fa-IR", {
    useGrouping: false,
    minimumIntegerDigits: minDigits,
  }).format(Number(value));
}

/**
 * Persian percentage using the Persian percent sign «٪», which is written to
 * the *left* of the number in Persian typographic convention — the opposite of
 * the Latin `%`. `12` → `«۱۲٪»`
 */
export function faPercent(value: number | null | undefined): string {
  return `${faDigits(Math.round(Number(value) || 0))}٪`;
}

/* ---------------------------------------------------------------------------
 * Money
 * ------------------------------------------------------------------------- */

export const CURRENCY_LABEL = "تومان";

/**
 * Price digits only — the caller renders «تومان» separately so it can be typed
 * down visually. Iranian storefronts consistently de-emphasise the unit
 * relative to the amount, and merging them into one string makes that
 * impossible.
 */
export function faPrice(value: number | null | undefined): string {
  return faNumber(value);
}

/**
 * Accessible price label, for `aria-label` on price blocks where the visual
 * layout splits amount and unit across elements.
 */
export function faPriceLabel(value: number | null | undefined): string {
  return `${faNumber(value)} ${CURRENCY_LABEL}`;
}

/* ---------------------------------------------------------------------------
 * Durations — Persian mental model
 * ------------------------------------------------------------------------- */

export type DurationParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isExpired: boolean;
};

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

/** Normalises anything date-like into a timestamp, or NaN. */
export function toTimestamp(value: string | number | Date | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function getDurationParts(
  target: string | number | Date | null | undefined,
  now: number = Date.now(),
): DurationParts {
  const timestamp = toTimestamp(target);
  const empty: DurationParts = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
    isExpired: true,
  };

  if (!Number.isFinite(timestamp)) return empty;

  const remaining = timestamp - now;
  if (remaining <= 0) return empty;

  return {
    days: Math.floor(remaining / MS_DAY),
    hours: Math.floor((remaining % MS_DAY) / MS_HOUR),
    minutes: Math.floor((remaining % MS_HOUR) / MS_MINUTE),
    seconds: Math.floor((remaining % MS_MINUTE) / MS_SECOND),
    totalMs: remaining,
    isExpired: false,
  };
}

export const DURATION_UNITS = {
  day: "روز",
  hour: "ساعت",
  minute: "دقیقه",
  second: "ثانیه",
} as const;

/**
 * Human, calm Persian phrasing of remaining time.
 *
 * Persian speakers describe remaining time at the granularity that matters and
 * stop there — «۲ روز و ۴ ساعت», not «۵۲ ساعت», and never «۵۲:۱۴:۰۹». This
 * returns at most two adjacent units, which keeps urgency credible instead of
 * theatrical.
 *
 *   3d 4h 12m  → «۳ روز و ۴ ساعت»
 *   4h 12m 30s → «۴ ساعت و ۱۲ دقیقه»
 *   12m 30s    → «۱۲ دقیقه و ۳۰ ثانیه»
 *   30s        → «۳۰ ثانیه»
 */
export function faDurationPhrase(
  target: string | number | Date | null | undefined,
  now: number = Date.now(),
): string {
  const { days, hours, minutes, seconds, isExpired } = getDurationParts(target, now);
  if (isExpired) return "";

  if (days > 0) {
    return hours > 0
      ? `${faDigits(days)} ${DURATION_UNITS.day} و ${faDigits(hours)} ${DURATION_UNITS.hour}`
      : `${faDigits(days)} ${DURATION_UNITS.day}`;
  }

  if (hours > 0) {
    return minutes > 0
      ? `${faDigits(hours)} ${DURATION_UNITS.hour} و ${faDigits(minutes)} ${DURATION_UNITS.minute}`
      : `${faDigits(hours)} ${DURATION_UNITS.hour}`;
  }

  if (minutes > 0) {
    return `${faDigits(minutes)} ${DURATION_UNITS.minute} و ${faDigits(seconds)} ${DURATION_UNITS.second}`;
  }

  return `${faDigits(seconds)} ${DURATION_UNITS.second}`;
}

/**
 * The two most significant units, as structured data, for segmented countdown
 * displays. Same truncation policy as `faDurationPhrase` so the compact and
 * expanded countdowns can never disagree.
 */
export function faDurationSegments(
  target: string | number | Date | null | undefined,
  now: number = Date.now(),
): Array<{ key: string; value: string; label: string }> {
  const parts = getDurationParts(target, now);
  if (parts.isExpired) return [];

  const all = [
    { key: "day", raw: parts.days, label: DURATION_UNITS.day, pad: 1 },
    { key: "hour", raw: parts.hours, label: DURATION_UNITS.hour, pad: 2 },
    { key: "minute", raw: parts.minutes, label: DURATION_UNITS.minute, pad: 2 },
    { key: "second", raw: parts.seconds, label: DURATION_UNITS.second, pad: 2 },
  ];

  // Start at the first non-zero unit so a 4-hour offer never renders a
  // meaningless "۰ روز" cell.
  const startIndex = all.findIndex((unit) => unit.raw > 0);
  const from = startIndex === -1 ? all.length - 1 : startIndex;

  return all
    .slice(from, from + 2)
    .map((unit) => ({ key: unit.key, value: faDigits(unit.raw, unit.pad), label: unit.label }));
}

/**
 * How often a countdown must re-render to stay honest.
 *
 * A multi-day offer displayed as «۳ روز و ۴ ساعت» does not change for an hour,
 * so ticking it every second burns battery and forces a React render per second
 * per card. Sub-minute offers still tick every second because that is when the
 * seconds digit is actually meaningful.
 */
export function durationTickInterval(
  target: string | number | Date | null | undefined,
  now: number = Date.now(),
): number {
  const { totalMs, isExpired } = getDurationParts(target, now);
  if (isExpired) return 0;
  if (totalMs > MS_DAY) return MS_MINUTE;
  if (totalMs > MS_HOUR) return MS_SECOND * 30;
  return MS_SECOND;
}

/* ---------------------------------------------------------------------------
 * Jalali dates
 * ------------------------------------------------------------------------- */

/**
 * Jalali (Solar Hijri) date in Persian. Iranian users do not read Gregorian
 * dates; showing them is a translation artefact, not localisation.
 * `«۱۴ اسفند ۱۴۰۳»`
 */
export function faDate(value: string | number | Date | null | undefined): string {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return "";

  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

/** Jalali date plus 24-hour time. `«۱۴ اسفند ۱۴۰۳، ۱۸:۳۰»` */
export function faDateTime(value: string | number | Date | null | undefined): string {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return "";

  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}
