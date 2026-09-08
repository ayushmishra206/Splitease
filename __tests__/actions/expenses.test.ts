import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockPrisma, mockTx, mockNotify } = vi.hoisted(() => {
  const mockTx = {
    expenseSplit: { deleteMany: vi.fn() },
    expensePayer: { deleteMany: vi.fn() },
    expense: { update: vi.fn() },
  };
  return {
    mockTx,
    mockNotify: vi.fn(),
    mockPrisma: {
      group: { findUnique: vi.fn() },
      groupMember: { findMany: vi.fn() },
      expense: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
      activityLog: { create: vi.fn() },
      user: { findUnique: vi.fn() },
      $transaction: vi.fn(async (arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: typeof mockTx) => unknown)(mockTx) : Promise.all(arg as unknown[])
      ),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({ id: USER, email: "me@test.com", name: "Me" })),
}));
vi.mock("@/lib/email/send", () => ({ sendEmailSafe: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ expenseAddedEmail: vi.fn(() => "<html/>") }));
vi.mock("@/lib/push", () => ({ notifyGroupMembers: mockNotify }));

import { createExpense, updateExpense, deleteExpense } from "@/actions/expenses";

// ── Fixtures ───────────────────────────────────────────────────────────────

const GROUP = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const ALICE = "33333333-3333-4333-8333-333333333333";
const BOB = "44444444-4444-4444-8444-444444444444";
const EXPENSE = "55555555-5555-4555-8555-555555555555";
const OUTSIDER = "66666666-6666-4666-8666-666666666666";

const activeGroup = {
  id: GROUP,
  name: "Trip",
  currency: "USD",
  status: "active",
  members: [{ memberId: USER }, { memberId: ALICE }, { memberId: BOB }],
};

const validInput = {
  groupId: GROUP,
  description: "Dinner",
  amount: 90,
  payerId: USER,
  expenseDate: "2026-09-08",
  splits: [
    { memberId: USER, share: 30 },
    { memberId: ALICE, share: 30 },
    { memberId: BOB, share: 30 },
  ],
};

function createdRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPENSE,
    groupId: GROUP,
    payerId: USER,
    createdById: USER,
    description: "Dinner",
    amount: "90",
    category: null,
    splitType: "equal",
    expenseDate: new Date("2026-09-08T00:00:00Z"),
    notes: null,
    receiptUrl: null,
    isRecurring: false,
    recurrenceRule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    group: { id: GROUP, name: "Trip", currency: "USD", ownerId: USER },
    payer: { id: USER, fullName: "Me", avatarUrl: null },
    createdBy: { id: USER, fullName: "Me" },
    payers: [{ id: "p1", memberId: USER, amount: "90", member: { id: USER, fullName: "Me", avatarUrl: null } }],
    splits: validInput.splits.map((s, i) => ({
      id: `s${i}`,
      expenseId: EXPENSE,
      memberId: s.memberId,
      share: String(s.share),
      member: { id: s.memberId, fullName: "X", avatarUrl: null },
    })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.group.findUnique.mockResolvedValue(activeGroup);
  mockPrisma.groupMember.findMany.mockResolvedValue([]);
  mockPrisma.expense.create.mockResolvedValue(createdRow());
  mockPrisma.user.findUnique.mockResolvedValue({ fullName: "Me" });
  mockTx.expense.update.mockResolvedValue(createdRow({ createdById: ALICE, createdBy: { id: ALICE, fullName: "Alice" } }));
});

// ── createExpense ──────────────────────────────────────────────────────────

describe("createExpense", () => {
  it("rejects when the caller is not a group member", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ ...activeGroup, members: [{ memberId: ALICE }] });
    await expect(createExpense({ ...validInput, payerId: ALICE, splits: [{ memberId: ALICE, share: 90 }] }))
      .rejects.toThrow("Not a member of this group");
    expect(mockPrisma.expense.create).not.toHaveBeenCalled();
  });

  it("rejects archived groups", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ ...activeGroup, status: "archived" });
    await expect(createExpense(validInput)).rejects.toThrow("archived");
  });

  it("rejects payers or participants outside the group", async () => {
    await expect(
      createExpense({ ...validInput, splits: [{ memberId: OUTSIDER, share: 90 }] })
    ).rejects.toThrow("must be group members");
  });

  it("rejects splits that do not add up before touching the database", async () => {
    await expect(
      createExpense({ ...validInput, splits: [{ memberId: USER, share: 10 }] })
    ).rejects.toThrow(/must add up/);
    expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a string amount (client type bug guard)", async () => {
    await expect(createExpense({ ...validInput, amount: "90" })).rejects.toThrow("Enter an amount");
  });

  it("stores one payer row per contributor and the largest as primary payer", async () => {
    await createExpense({
      ...validInput,
      payers: [
        { memberId: USER, amount: 30 },
        { memberId: ALICE, amount: 60 },
      ],
    });
    const data = mockPrisma.expense.create.mock.calls[0][0].data;
    expect(data.payerId).toBe(ALICE);
    expect(data.payers.create).toEqual([
      { memberId: USER, amount: 30 },
      { memberId: ALICE, amount: 60 },
    ]);
    expect(data.createdById).toBe(USER);
  });

  it("writes an activity log entry (awaited, not fire-and-forget)", async () => {
    await createExpense(validInput);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.activityLog.create.mock.calls[0][0].data.entityType).toBe("expense");
  });

  it("returns numeric amounts", async () => {
    const result = await createExpense(validInput);
    expect(result.amount).toBe(90);
    expect(result.splits[0].share).toBe(30);
    expect(result.payers[0].amount).toBe(90);
  });
});

// ── updateExpense ──────────────────────────────────────────────────────────

describe("updateExpense", () => {
  const existing = {
    groupId: GROUP,
    createdById: ALICE, // added by someone else
    payerId: ALICE,
    description: "Dinner",
    isRecurring: false,
    recurrenceRule: null,
    group: { members: activeGroup.members },
  };

  it("lets any group member edit an expense they did not add", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(existing);
    const result = await updateExpense({ id: EXPENSE, ...validInput });
    expect(mockTx.expense.update).toHaveBeenCalledTimes(1);
    expect(mockTx.expenseSplit.deleteMany).toHaveBeenCalledWith({ where: { expenseId: EXPENSE } });
    expect(mockTx.expensePayer.deleteMany).toHaveBeenCalledWith({ where: { expenseId: EXPENSE } });
    expect(result.id).toBe(EXPENSE);
    // The original author is told who changed it
    const log = mockPrisma.activityLog.create.mock.calls[0][0].data.description;
    expect(log).toMatch(/added by Alice/);
    expect(mockNotify).toHaveBeenCalled();
  });

  it("rejects non-members", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({
      ...existing,
      group: { members: [{ memberId: ALICE }, { memberId: BOB }] },
    });
    await expect(updateExpense({ id: EXPENSE, ...validInput })).rejects.toThrow("Only group members");
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("refuses to move an expense to another group", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ ...existing, groupId: "77777777-7777-4777-8777-777777777777" });
    await expect(updateExpense({ id: EXPENSE, ...validInput })).rejects.toThrow("cannot be moved");
  });

  it("returns a readable error for an unknown expense", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(null);
    await expect(updateExpense({ id: EXPENSE, ...validInput })).rejects.toThrow("Expense not found");
  });
});

// ── deleteExpense ──────────────────────────────────────────────────────────

describe("deleteExpense", () => {
  const base = {
    createdById: ALICE,
    payerId: ALICE,
    groupId: GROUP,
    description: "Dinner",
    amount: "90",
    payers: [{ memberId: ALICE }],
    group: { name: "Trip", currency: "USD", ownerId: BOB, status: "active", members: activeGroup.members },
  };

  it("blocks a member who neither added, paid, nor owns the group", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(base);
    await expect(deleteExpense(EXPENSE)).rejects.toThrow(/Only the person who added or paid/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows the group owner", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ ...base, group: { ...base.group, ownerId: USER } });
    await deleteExpense(EXPENSE);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("allows one of several payers", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ ...base, payers: [{ memberId: ALICE }, { memberId: USER }] });
    await deleteExpense(EXPENSE);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("falls back to the legacy payerId when there are no payer rows", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ ...base, payerId: USER, payers: [] });
    await deleteExpense(EXPENSE);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("blocks deletion in archived groups", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ ...base, group: { ...base.group, status: "archived", ownerId: USER } });
    await expect(deleteExpense(EXPENSE)).rejects.toThrow("archived");
  });

  it("rejects malformed ids", async () => {
    await expect(deleteExpense("not-a-uuid")).rejects.toThrow("Invalid id");
  });
});
