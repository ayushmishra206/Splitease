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

export function computeEqualSplit(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((total * 100) / count) / 100;
  const remainder = Math.round((total - base * count) * 100);
  return Array.from({ length: count }, (_, i) =>
    Math.round((base + (i < remainder ? 0.01 : 0)) * 100) / 100
  );
}
