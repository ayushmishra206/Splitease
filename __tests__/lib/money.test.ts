import { describe, it, expect } from "vitest";
import { roundMoney, sumMoney, moneyEquals, parseAmount, toNumber, isValidMoney } from "@/lib/money";

describe("roundMoney", () => {
  it("rounds to two decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});

describe("sumMoney", () => {
  it("sums without floating point drift", () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([])).toBe(0);
  });
});

describe("moneyEquals", () => {
  it("treats sub-cent differences as equal", () => {
    expect(moneyEquals(10, 10.004)).toBe(true);
    expect(moneyEquals(10, 10.01)).toBe(false);
  });
});

describe("parseAmount", () => {
  it("parses numbers and numeric strings", () => {
    expect(parseAmount(12.5)).toBe(12.5);
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("1,234.56")).toBe(1234.56);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(NaN)).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount(Infinity)).toBeNull();
  });

  it("handles Prisma Decimal-like objects via toString", () => {
    const decimalLike = { toString: () => "42.10" };
    expect(parseAmount(decimalLike)).toBe(42.1);
    expect(toNumber(decimalLike)).toBe(42.1);
  });

  it("toNumber never returns NaN", () => {
    expect(toNumber("nope")).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});

describe("isValidMoney", () => {
  it("accepts positive amounts with up to two decimals", () => {
    expect(isValidMoney(0.01)).toBe(true);
    expect(isValidMoney(100)).toBe(true);
    expect(isValidMoney(99.99)).toBe(true);
  });

  it("rejects zero, negatives, NaN and more than two decimals", () => {
    expect(isValidMoney(0)).toBe(false);
    expect(isValidMoney(-5)).toBe(false);
    expect(isValidMoney(NaN)).toBe(false);
    expect(isValidMoney(1.005)).toBe(false);
    expect(isValidMoney(1.234)).toBe(false);
  });
});
