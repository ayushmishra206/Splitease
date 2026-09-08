"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { roundMoney, toNumber } from "@/lib/money";
import { uuid, parseOrThrow } from "@/lib/validation";

export type GroupDetailData = {
  group: {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    ownerId: string;
    status: string;
  };
  members: Array<{
    id: string;
    fullName: string;
    avatarUrl: string | null;
    role: string;
  }>;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string | null;
    splitType: string;
    expenseDate: Date;
    notes: string | null;
    receiptUrl: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
    payerId: string | null;
    payerName: string;
    createdById: string | null;
    createdByName: string;
    createdAt: Date;
    payers: Array<{ memberId: string; memberName: string; amount: number }>;
    splits: Array<{ memberId: string; memberName: string; share: number }>;
  }>;
  settlements: Array<{
    id: string;
    fromMember: string;
    fromName: string;
    toMember: string;
    toName: string;
    amount: number;
    settlementDate: Date;
    notes: string | null;
    createdAt: Date;
  }>;
  activityLogs: Array<{
    action: string;
    entityType: string;
    description: string;
    userName: string;
    createdAt: Date;
  }>;
  /** Group-wide totals. */
  totals: {
    /** Sum of all expense amounts in the group. */
    totalSpent: number;
    /** Sum of the current user's shares across all expenses. */
    yourShare: number;
    /** Sum of what the current user actually paid. */
    youPaid: number;
    /** Sum of all settlements recorded in the group. */
    totalSettled: number;
    expenseCount: number;
  };
};

export async function fetchGroupDetail(rawGroupId: string): Promise<GroupDetailData> {
  const user = await getAuthenticatedUser();
  const groupId = parseOrThrow(uuid, rawGroupId);

  // Membership check first so non-members cannot probe for group existence
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId, memberId: user.id } },
    select: { groupId: true },
  });
  if (!membership) throw new Error("Not a member of this group");

  const [group, members, expenses, settlements, activityLogs] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { id: true, name: true, description: true, currency: true, ownerId: true, status: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      include: { member: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
        payers: {
          include: { member: { select: { id: true, fullName: true } } },
          orderBy: { amount: "desc" },
        },
        splits: { include: { member: { select: { id: true, fullName: true } } } },
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.settlement.findMany({
      where: { groupId },
      include: {
        from: { select: { id: true, fullName: true } },
        to: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.findMany({
      where: { groupId },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  let totalSpent = 0;
  let yourShare = 0;
  let youPaid = 0;

  const mappedExpenses = expenses.map((e) => {
    const amount = toNumber(e.amount);
    totalSpent += amount;

    const payers =
      e.payers.length > 0
        ? e.payers.map((p) => ({
            memberId: p.memberId,
            memberName: p.member.fullName ?? "Unknown",
            amount: toNumber(p.amount),
          }))
        : e.payer
          ? [{ memberId: e.payer.id, memberName: e.payer.fullName ?? "Unknown", amount }]
          : [];

    for (const p of payers) if (p.memberId === user.id) youPaid += p.amount;

    const splits = e.splits.map((s) => {
      const share = toNumber(s.share);
      if (s.memberId === user.id) yourShare += share;
      return { memberId: s.memberId, memberName: s.member.fullName ?? "Unknown", share };
    });

    return {
      id: e.id,
      description: e.description,
      amount,
      category: e.category,
      splitType: e.splitType,
      expenseDate: e.expenseDate,
      notes: e.notes,
      receiptUrl: e.receiptUrl,
      isRecurring: e.isRecurring,
      recurrenceRule: e.recurrenceRule,
      payerId: e.payerId,
      payerName: payers.length > 0 ? payers[0].memberName : "Unknown",
      createdById: e.createdById,
      createdByName: e.createdBy?.fullName ?? payers[0]?.memberName ?? "Unknown",
      createdAt: e.createdAt,
      payers,
      splits,
    };
  });

  const mappedSettlements = settlements.map((s) => ({
    id: s.id,
    fromMember: s.fromMember,
    fromName: s.from.fullName ?? "Unknown",
    toMember: s.toMember,
    toName: s.to.fullName ?? "Unknown",
    amount: toNumber(s.amount),
    settlementDate: s.settlementDate,
    notes: s.notes,
    createdAt: s.createdAt,
  }));

  return {
    group,
    members: members.map((m) => ({
      id: m.member.id,
      fullName: m.member.fullName ?? "Unknown",
      avatarUrl: m.member.avatarUrl,
      role: m.role,
    })),
    expenses: mappedExpenses,
    settlements: mappedSettlements,
    activityLogs: activityLogs.map((a) => ({
      action: a.action,
      entityType: a.entityType,
      description: a.description,
      userName: a.user.fullName ?? "Unknown",
      createdAt: a.createdAt,
    })),
    totals: {
      totalSpent: roundMoney(totalSpent),
      yourShare: roundMoney(yourShare),
      youPaid: roundMoney(youPaid),
      totalSettled: roundMoney(mappedSettlements.reduce((sum, s) => sum + s.amount, 0)),
      expenseCount: expenses.length,
    },
  };
}
