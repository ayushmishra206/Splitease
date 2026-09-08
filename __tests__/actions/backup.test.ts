import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    group: { upsert: vi.fn() },
    groupMember: { upsert: vi.fn() },
    expense: { findMany: vi.fn(), upsert: vi.fn() },
    expenseSplit: { deleteMany: vi.fn(), createMany: vi.fn() },
    expensePayer: { deleteMany: vi.fn(), createMany: vi.fn() },
    settlement: { findMany: vi.fn(), upsert: vi.fn() },
  };
  return {
    mockTx,
    mockPrisma: {
      user: { findMany: vi.fn() },
      group: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({ id: ME, email: "me@test.com", name: "Me" })),
}));

import { importUserData } from "@/actions/backup";

const ME = "22222222-2222-4222-8222-222222222222";
const ALICE = "33333333-3333-4333-8333-333333333333";
const GROUP = "11111111-1111-4111-8111-111111111111";
const EXPENSE = "55555555-5555-4555-8555-555555555555";
const SETTLEMENT = "66666666-6666-4666-8666-666666666666";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    groups: [
      {
        id: GROUP,
        name: "Trip",
        currency: "USD",
        ownerId: ME,
        members: [
          { memberId: ME, role: "owner" },
          { memberId: ALICE, role: "member" },
        ],
        expenses: [
          {
            id: EXPENSE,
            description: "Dinner",
            amount: 40,
            expenseDate: "2026-09-01",
            payerId: ME,
            payers: [{ memberId: ME, amount: 40 }],
            splits: [
              { memberId: ME, share: 20 },
              { memberId: ALICE, share: 20 },
            ],
          },
        ],
        settlements: [
          { id: SETTLEMENT, fromMember: ALICE, toMember: ME, amount: 20, settlementDate: "2026-09-02" },
        ],
        ...overrides,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findMany.mockResolvedValue([{ id: ME }, { id: ALICE }]);
  mockPrisma.group.findMany.mockResolvedValue([]);
  mockTx.expense.findMany.mockResolvedValue([]);
  mockTx.settlement.findMany.mockResolvedValue([]);
});

describe("importUserData", () => {
  it("imports a well-formed v2 backup", async () => {
    const result = await importUserData(payload());
    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([]);
    expect(mockTx.group.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.expense.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.expensePayer.createMany).toHaveBeenCalledWith({
      data: [{ expenseId: EXPENSE, memberId: ME, amount: 40 }],
    });
    expect(mockTx.settlement.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed files with a readable error", async () => {
    await expect(importUserData({ hello: "world" })).rejects.toThrow("Unsupported or malformed backup file");
  });

  it("skips groups the payload says are owned by someone else", async () => {
    const result = await importUserData(payload({ ownerId: ALICE }));
    expect(result.imported).toBe(0);
    expect(result.skipped[0].reason).toBe("Not owned by you");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("skips a group whose id already belongs to another user, even if the file claims otherwise", async () => {
    mockPrisma.group.findMany.mockResolvedValue([{ id: GROUP, ownerId: ALICE }]);
    const result = await importUserData(payload());
    expect(result.imported).toBe(0);
    expect(result.skipped[0].reason).toMatch(/belongs to someone else/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not replace an expense or settlement that lives in a different group", async () => {
    mockTx.expense.findMany.mockResolvedValue([{ id: EXPENSE }]);
    mockTx.settlement.findMany.mockResolvedValue([{ id: SETTLEMENT }]);
    const result = await importUserData(payload());
    expect(result.imported).toBe(1);
    expect(mockTx.expense.upsert).not.toHaveBeenCalled();
    expect(mockTx.expenseSplit.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.expensePayer.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.settlement.upsert).not.toHaveBeenCalled();
    expect(result.skipped[0].reason).toMatch(/1 expense\(s\) and 1 settlement\(s\) belong to another group/);
    // The lookups were scoped to "not this group"
    expect(mockTx.expense.findMany.mock.calls[0][0].where.groupId).toEqual({ not: GROUP });
  });

  it("drops members, payers and participants that are not real accounts", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: ME }]);
    const result = await importUserData(payload());
    expect(result.imported).toBe(1);
    // Only the owner is (re)attached
    expect(mockTx.groupMember.upsert).toHaveBeenCalledTimes(1);
    // Alice's split is dropped; the settlement with Alice is skipped
    expect(mockTx.expenseSplit.createMany).toHaveBeenCalledWith({
      data: [{ expenseId: EXPENSE, memberId: ME, share: 20 }],
    });
    expect(mockTx.settlement.upsert).not.toHaveBeenCalled();
  });

  it("accepts the legacy v1 format", async () => {
    const legacy = {
      version: 1,
      groups: [
        {
          id: GROUP,
          name: "Old",
          currency: "USD",
          ownerId: ME,
          members: [{ groupId: GROUP, memberId: ME, role: "owner" }],
          expenses: [
            {
              id: EXPENSE,
              groupId: GROUP,
              payerId: ME,
              description: "Legacy",
              amount: "10",
              expenseDate: "2025-01-01",
              splits: [{ id: "s1", expenseId: EXPENSE, memberId: ME, share: "10" }],
            },
          ],
          settlements: [],
        },
      ],
    };
    const result = await importUserData(legacy);
    expect(result.imported).toBe(1);
    expect(mockTx.expense.upsert.mock.calls[0][0].create.amount).toBe(10);
  });
});
