import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockNotify } = vi.hoisted(() => ({
  mockNotify: vi.fn(),
  mockPrisma: {
    expense: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/push", () => ({ notifyGroupMembers: mockNotify }));

import { GET } from "@/app/api/cron/recurring-expenses/route";

const ME = "22222222-2222-4222-8222-222222222222";
const ALICE = "33333333-3333-4333-8333-333333333333";
const BOB = "44444444-4444-4444-8444-444444444444";
const GROUP = "11111111-1111-4111-8111-111111111111";

function template(members: string[], overrides: Record<string, unknown> = {}) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    groupId: GROUP,
    payerId: ME,
    createdById: ME,
    description: "Rent",
    amount: "900",
    category: "rent",
    splitType: "equal",
    notes: null,
    isRecurring: true,
    recurrenceRule: "monthly",
    nextOccurrence: new Date("2026-09-01T00:00:00.000Z"),
    splits: [
      { memberId: ME, share: "300" },
      { memberId: ALICE, share: "300" },
      { memberId: BOB, share: "300" },
    ],
    payers: [{ memberId: ME, amount: "900" }],
    group: { name: "Flat", currency: "USD", members: members.map((memberId) => ({ memberId })) },
    ...overrides,
  };
}

function request() {
  return new Request("http://localhost/api/cron/recurring-expenses", {
    headers: { authorization: "Bearer test-secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

describe("GET /api/cron/recurring-expenses", () => {
  it("rejects requests without the cron secret", async () => {
    const res = await GET(new Request("http://localhost/api/cron/recurring-expenses"));
    expect(res.status).toBe(401);
  });

  it("rejects everything when no secret is configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new Request("http://localhost/x", { headers: { authorization: "Bearer undefined" } }));
    expect(res.status).toBe(401);
  });

  it("creates a full copy dated on the scheduled day and advances the schedule", async () => {
    mockPrisma.expense.findMany.mockResolvedValue([template([ME, ALICE, BOB])]);
    const res = await GET(request());
    expect(await res.json()).toEqual({ created: 1, stopped: 0 });

    const created = mockPrisma.expense.create.mock.calls[0][0].data;
    expect(created.expenseDate).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(created.splits.create).toHaveLength(3);
    expect(created.payers.create).toEqual([{ memberId: ME, amount: "900" }]);
    expect(created.createdById).toBe(ME);

    const update = mockPrisma.expense.update.mock.calls[0][0].data;
    expect(update.nextOccurrence).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(mockNotify).toHaveBeenCalled();
  });

  it("stops the recurrence instead of creating a partial copy when a participant left", async () => {
    mockPrisma.expense.findMany.mockResolvedValue([template([ME, ALICE])]); // Bob left
    const res = await GET(request());
    expect(await res.json()).toEqual({ created: 0, stopped: 1 });

    expect(mockPrisma.expense.create).not.toHaveBeenCalled();
    const update = mockPrisma.expense.update.mock.calls[0][0].data;
    expect(update).toEqual({ isRecurring: false, nextOccurrence: null });
    const log = mockPrisma.activityLog.create.mock.calls[0][0].data;
    expect(log.description).toMatch(/Stopped repeating "Rent"/);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("stops the recurrence when one of several payers left", async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      template([ME, ALICE, BOB], {
        payers: [
          { memberId: ME, amount: "450" },
          { memberId: "77777777-7777-4777-8777-777777777777", amount: "450" },
        ],
      }),
    ]);
    const res = await GET(request());
    expect(await res.json()).toEqual({ created: 0, stopped: 1 });
    expect(mockPrisma.expense.create).not.toHaveBeenCalled();
  });

  it("treats a legacy template (no payer rows) as paid by payerId", async () => {
    mockPrisma.expense.findMany.mockResolvedValue([template([ME, ALICE, BOB], { payers: [] })]);
    const res = await GET(request());
    expect(await res.json()).toEqual({ created: 1, stopped: 0 });
  });
});
