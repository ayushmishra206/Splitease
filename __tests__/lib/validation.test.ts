import { describe, it, expect } from "vitest";
import { expenseInputSchema, settlementInputSchema, parseOrThrow, uuid } from "@/lib/validation";

const g = "11111111-1111-4111-8111-111111111111";
const a = "22222222-2222-4222-8222-222222222222";
const b = "33333333-3333-4333-8333-333333333333";

const baseExpense = {
  groupId: g,
  description: "Dinner",
  amount: 100,
  payerId: a,
  expenseDate: "2026-09-08",
  splits: [
    { memberId: a, share: 50 },
    { memberId: b, share: 50 },
  ],
};

describe("expenseInputSchema", () => {
  it("accepts a valid single-payer expense", () => {
    expect(expenseInputSchema.safeParse(baseExpense).success).toBe(true);
  });

  it("accepts a valid multi-payer expense", () => {
    const result = expenseInputSchema.safeParse({
      ...baseExpense,
      payers: [
        { memberId: a, amount: 60 },
        { memberId: b, amount: 40 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects splits that do not add up to the amount", () => {
    const result = expenseInputSchema.safeParse({
      ...baseExpense,
      splits: [
        { memberId: a, share: 50 },
        { memberId: b, share: 40 },
      ],
    });
    expect(result.success).toBe(false);
    expect(() => parseOrThrow(expenseInputSchema, { ...baseExpense, splits: [{ memberId: a, share: 1 }] })).toThrow(
      /Splits .* must add up/
    );
  });

  it("rejects payers that do not add up to the amount", () => {
    const result = expenseInputSchema.safeParse({
      ...baseExpense,
      payers: [
        { memberId: a, amount: 60 },
        { memberId: b, amount: 60 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate participants and payers", () => {
    expect(
      expenseInputSchema.safeParse({
        ...baseExpense,
        splits: [
          { memberId: a, share: 50 },
          { memberId: a, share: 50 },
        ],
      }).success
    ).toBe(false);
    expect(
      expenseInputSchema.safeParse({
        ...baseExpense,
        payers: [
          { memberId: a, amount: 50 },
          { memberId: a, amount: 50 },
        ],
      }).success
    ).toBe(false);
  });

  it("rejects non-numeric, zero, negative and over-precise amounts", () => {
    for (const amount of [NaN, 0, -5, 1.005, "12" as unknown as number]) {
      expect(expenseInputSchema.safeParse({ ...baseExpense, amount, splits: [{ memberId: a, share: amount }] }).success).toBe(false);
    }
  });

  it("rejects invalid dates and empty descriptions", () => {
    expect(expenseInputSchema.safeParse({ ...baseExpense, expenseDate: "2026-02-30" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...baseExpense, description: "   " }).success).toBe(false);
  });

  it("requires a recurrence rule when recurring", () => {
    expect(expenseInputSchema.safeParse({ ...baseExpense, isRecurring: true }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...baseExpense, isRecurring: true, recurrenceRule: "monthly" }).success).toBe(true);
  });

  it("tolerates sub-cent rounding in splits", () => {
    const result = expenseInputSchema.safeParse({
      ...baseExpense,
      amount: 10,
      splits: [
        { memberId: a, share: 3.33 },
        { memberId: b, share: 6.67 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("settlementInputSchema", () => {
  const base = { groupId: g, fromMember: a, toMember: b, amount: 25, settlementDate: "2026-09-08" };

  it("accepts a valid settlement", () => {
    expect(settlementInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects paying yourself", () => {
    const result = settlementInputSchema.safeParse({ ...base, toMember: a });
    expect(result.success).toBe(false);
  });

  it("rejects string amounts (the bug behind the settlements form)", () => {
    expect(settlementInputSchema.safeParse({ ...base, amount: "25" }).success).toBe(false);
  });
});

describe("parseOrThrow", () => {
  it("throws the first readable issue", () => {
    expect(() => parseOrThrow(uuid, "nope")).toThrow("Invalid id");
  });
});
