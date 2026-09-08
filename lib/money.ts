/**
 * Money helpers. All amounts in the app are plain JS numbers with at most two
 * decimals; Prisma `Decimal` values are converted at the server boundary.
 */

/** Round to two decimals, avoiding the usual floating point drift. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sum a list of amounts and round once at the end. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + v, 0));
}

/** True when two amounts are equal within a cent. */
export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/**
 * Parse user input (number input value, string, Decimal-like) into a finite
 * number, or `null` when it is empty or not a number. Accepts "1,234.50".
 */
export function parseAmount(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const text = String(input).trim().replace(/,/g, "");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Convert a Prisma Decimal (or anything numeric-like) to a number; NaN-safe. */
export function toNumber(value: unknown): number {
  return parseAmount(value) ?? 0;
}

/** True when the amount is positive, finite, and has no more than 2 decimals. */
export function isValidMoney(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}
