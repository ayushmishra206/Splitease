import { describe, it, expect } from "vitest";
import { normalizePayers, computeNextOccurrence, buildExpenseFormDefaults } from "@/lib/expenses-shared";
import { dateOnlyKey } from "@/lib/dates";

describe("normalizePayers", () => {
  it("falls back to the single payer when no payer list is given", () => {
    expect(normalizePayers(undefined, "a", 50)).toEqual({
      payers: [{ memberId: "a", amount: 50 }],
      primaryPayerId: "a",
    });
  });

  it("drops zero rows and picks the largest contributor as primary", () => {
    const result = normalizePayers(
      [
        { memberId: "a", amount: 20 },
        { memberId: "b", amount: 0 },
        { memberId: "c", amount: 80 },
      ],
      "a",
      100
    );
    expect(result.payers).toEqual([
      { memberId: "a", amount: 20 },
      { memberId: "c", amount: 80 },
    ]);
    expect(result.primaryPayerId).toBe("c");
  });

  it("keeps the first payer on ties", () => {
    const result = normalizePayers(
      [
        { memberId: "a", amount: 50 },
        { memberId: "b", amount: 50 },
      ],
      "b",
      100
    );
    expect(result.primaryPayerId).toBe("a");
  });
});

describe("computeNextOccurrence", () => {
  it("advances by the rule in UTC", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    expect(computeNextOccurrence(start, "weekly").toISOString()).toBe("2026-02-07T00:00:00.000Z");
    expect(computeNextOccurrence(start, "biweekly").toISOString()).toBe("2026-02-14T00:00:00.000Z");
    expect(computeNextOccurrence(start, "yearly").toISOString()).toBe("2027-01-31T00:00:00.000Z");
  });

  it("returns an unchanged copy for unknown rules", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    const next = computeNextOccurrence(start, "never");
    expect(next.getTime()).toBe(start.getTime());
    expect(next).not.toBe(start);
  });
});

describe("buildExpenseFormDefaults", () => {
  it("maps a stored expense, deriving payers from payerId for legacy rows", () => {
    const defaults = buildExpenseFormDefaults(
      {
        groupId: "g",
        description: "Taxi",
        amount: 30,
        category: null,
        payerId: "a",
        payers: [],
        expenseDate: new Date("2026-05-05T00:00:00.000Z"),
        notes: null,
        receiptUrl: null,
        splitType: "equal",
        splits: [
          { memberId: "a", share: 15 },
          { memberId: "b", share: 15 },
        ],
      },
      dateOnlyKey
    );
    expect(defaults.payers).toEqual([{ memberId: "a", amount: 30 }]);
    expect(defaults.expenseDate).toBe("2026-05-05");
    expect(defaults.participantIds).toEqual(["a", "b"]);
    expect(defaults.customSplits).toEqual({ a: 15, b: 15 });
    expect(defaults.category).toBeUndefined();
  });
});
