import { describe, it, expect } from "vitest";
import { formatCurrency, computeEqualSplit, cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});

describe("formatCurrency", () => {
  it("formats USD correctly", () => {
    expect(formatCurrency(1234.56, "USD")).toBe("$1,234.56");
  });

  it("formats string amounts", () => {
    expect(formatCurrency("99.9", "USD")).toBe("$99.90");
  });

  it("defaults to USD", () => {
    expect(formatCurrency(10)).toBe("$10.00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-25.5, "USD")).toBe("-$25.50");
  });

  it("formats EUR", () => {
    const result = formatCurrency(100, "EUR");
    // Intl formats vary by environment, just check it contains a number
    expect(result).toContain("100");
  });
});

describe("computeEqualSplit", () => {
  it("returns empty for zero count", () => {
    expect(computeEqualSplit(100, 0)).toEqual([]);
  });

  it("returns empty for negative count", () => {
    expect(computeEqualSplit(100, -1)).toEqual([]);
  });

  it("splits evenly when divisible", () => {
    const result = computeEqualSplit(100, 4);
    expect(result).toEqual([25, 25, 25, 25]);
  });

  it("splits evenly for 2 people", () => {
    const result = computeEqualSplit(100, 2);
    expect(result).toEqual([50, 50]);
  });

  it("distributes remainder correctly for 3 people", () => {
    const result = computeEqualSplit(100, 3);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
    expect(result).toHaveLength(3);
  });

  it("handles small amounts", () => {
    const result = computeEqualSplit(0.01, 3);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0.01, 2);
  });

  it("handles single person", () => {
    expect(computeEqualSplit(100, 1)).toEqual([100]);
  });
});
