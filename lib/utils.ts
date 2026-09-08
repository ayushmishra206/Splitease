import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Split `total` into `count` equal shares of whole cents. Any leftover cents
 * (e.g. 100 / 3) go to the first participants so the shares always sum to `total`.
 */
export function computeEqualSplit(total: number, count: number): number[] {
  if (count <= 0 || !Number.isFinite(total) || total < 0) return [];
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

/** Display name for a member, using "You" for the current user. */
export function displayName(
  member: { id: string; fullName: string | null } | null | undefined,
  currentUserId: string,
  youLabel = "You"
): string {
  if (!member) return "Unknown";
  if (member.id === currentUserId) return youLabel;
  return member.fullName ?? "Unknown";
}

/** "You, Alice and Bob" style joins for short lists of names. */
export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
