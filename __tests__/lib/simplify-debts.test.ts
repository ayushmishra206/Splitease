import { describe, it, expect } from "vitest";
import { simplifyDebts, computeNetBalances } from "@/lib/simplify-debts";

describe("simplifyDebts", () => {
  it("returns empty for empty object", () => {
    expect(simplifyDebts({})).toEqual([]);
  });

  it("returns empty when all balances are zero", () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it("simplifies a two-person debt", () => {
    const result = simplifyDebts({ a: 50, b: -50 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: "b", to: "a", amount: 50 });
  });

  it("simplifies three-person debt", () => {
    const result = simplifyDebts({ a: 30, b: -20, c: -10 });
    expect(result).toHaveLength(2);
    const totalTransferred = result.reduce((sum, t) => sum + t.amount, 0);
    expect(totalTransferred).toBe(30);
    // All transfers should go to "a"
    expect(result.every((t) => t.to === "a")).toBe(true);
  });

  it("minimizes transactions with 4 people", () => {
    const result = simplifyDebts({ a: 40, b: -10, c: -20, d: -10 });
    expect(result.length).toBeLessThanOrEqual(3);
    const totalTransferred = result.reduce((sum, t) => sum + t.amount, 0);
    expect(totalTransferred).toBe(40);
  });

  it("handles near-zero balances (rounding)", () => {
    const result = simplifyDebts({ a: 0.001, b: -0.001 });
    expect(result).toEqual([]);
  });

  it("handles multiple creditors and debtors", () => {
    // a is owed 60, b is owed 40. c owes 50, d owes 50.
    const result = simplifyDebts({ a: 60, b: 40, c: -50, d: -50 });
    const totalPaid = result.reduce((sum, t) => sum + t.amount, 0);
    expect(totalPaid).toBe(100);
  });

  it("handles single person with balance (impossible in practice but safe)", () => {
    // Only one person has a positive balance, no debtors
    const result = simplifyDebts({ a: 100 });
    expect(result).toEqual([]);
  });
});

describe("computeNetBalances", () => {
  it("returns empty for no data", () => {
    expect(computeNetBalances([], [])).toEqual({});
  });

  it("computes correct balances for single expense", () => {
    const result = computeNetBalances(
      [
        {
          payerId: "a",
          amount: 100,
          splits: [
            { memberId: "a", share: 50 },
            { memberId: "b", share: 50 },
          ],
        },
      ],
      []
    );
    expect(result.a).toBe(50); // paid 100, owes 50 -> net +50
    expect(result.b).toBe(-50); // owes 50
  });

  it("accounts for settlements", () => {
    const result = computeNetBalances(
      [
        {
          payerId: "a",
          amount: 100,
          splits: [
            { memberId: "a", share: 50 },
            { memberId: "b", share: 50 },
          ],
        },
      ],
      [{ fromMember: "b", toMember: "a", amount: 50 }]
    );
    // Settlement: b paid a 50, so net[b] -= 50, net[a] += 50
    // a: paid 100 - owes 50 + received settlement 50 = 100
    // b: owes 50 + paid settlement 50 = -100
    expect(result.a).toBe(100);
    expect(result.b).toBe(-100);
  });

  it("skips expenses with null payer", () => {
    const result = computeNetBalances(
      [
        {
          payerId: null,
          amount: 100,
          splits: [{ memberId: "a", share: 100 }],
        },
      ],
      []
    );
    // null payer means the expense is skipped entirely (both payer credit and splits)
    expect(result).toEqual({});
  });

  it("handles multiple expenses and settlements", () => {
    const result = computeNetBalances(
      [
        {
          payerId: "a",
          amount: 60,
          splits: [
            { memberId: "a", share: 20 },
            { memberId: "b", share: 20 },
            { memberId: "c", share: 20 },
          ],
        },
        {
          payerId: "b",
          amount: 30,
          splits: [
            { memberId: "a", share: 15 },
            { memberId: "b", share: 15 },
          ],
        },
      ],
      [{ fromMember: "c", toMember: "a", amount: 10 }]
    );
    // a: paid 60 - owes 20 - owes 15 + received 10 = 35
    expect(result.a).toBe(35);
    // b: paid 30 - owes 20 - owes 15 = -5
    expect(result.b).toBe(-5);
    // c: -20 - 10 = -30
    expect(result.c).toBe(-30);
  });
});
