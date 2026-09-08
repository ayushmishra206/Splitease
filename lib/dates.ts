import { format } from "date-fns";

/**
 * Helpers for "date-only" values (Prisma `@db.Date` columns).
 *
 * Prisma returns a `@db.Date` column as a JS Date at **UTC midnight**. Formatting
 * that Date with local-time APIs in a timezone west of UTC yields the previous
 * day. These helpers always read the UTC calendar fields so the day shown matches
 * the day stored.
 */

/** Today's date as `yyyy-MM-dd` in the user's local timezone. */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Convert a date-only value (Date at UTC midnight, or a `yyyy-MM-dd` string) to a local-midnight Date. */
export function dateOnlyToLocal(value: Date | string): Date {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    value = new Date(value);
  }
  return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/** `yyyy-MM-dd` key for a date-only value, safe across timezones. */
export function dateOnlyKey(value: Date | string): string {
  return format(dateOnlyToLocal(value), "yyyy-MM-dd");
}

/** Format a date-only value with a date-fns pattern, safe across timezones. */
export function formatDateOnly(value: Date | string, pattern = "MMM d, yyyy"): string {
  return format(dateOnlyToLocal(value), pattern);
}

/** Validate a `yyyy-MM-dd` string represents a real calendar date. */
export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  );
}
