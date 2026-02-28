"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export type GroupDetailData = {
  group: {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    ownerId: string;
  };
  members: Array<{
    id: string;
    fullName: string;
    role: string;
  }>;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    expenseDate: Date;
    notes: string | null;
    payerId: string;
    payerName: string;
    createdAt: Date;
    splits: Array<{
      memberId: string;
      memberName: string;
      share: number;
    }>;
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
};

export async function fetchGroupDetail(groupId: string): Promise<GroupDetailData> {
  const user = await getAuthenticatedUser();

  // Verify membership
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  const [group, members, expenses, settlements] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { id: true, name: true, description: true, currency: true, ownerId: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      include: { member: { select: { id: true, fullName: true } } },
    }),
    prisma.expense.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, fullName: true } },
        splits: { include: { member: { select: { id: true, fullName: true } } } },
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      include: {
        from: { select: { id: true, fullName: true } },
        to: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    group,
    members: members.map((m) => ({
      id: m.member.id,
      fullName: m.member.fullName ?? "Unknown",
      role: m.role,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: parseFloat(String(e.amount)),
      expenseDate: e.expenseDate,
      notes: e.notes,
      payerId: e.payerId,
      payerName: e.payer.fullName ?? "Unknown",
      createdAt: e.createdAt,
      splits: e.splits.map((s) => ({
        memberId: s.memberId,
        memberName: s.member.fullName ?? "Unknown",
        share: parseFloat(String(s.share)),
      })),
    })),
    settlements: settlements.map((s) => ({
      id: s.id,
      fromMember: s.fromMember,
      fromName: s.from.fullName ?? "Unknown",
      toMember: s.toMember,
      toName: s.to.fullName ?? "Unknown",
      amount: parseFloat(String(s.amount)),
      settlementDate: s.settlementDate,
      notes: s.notes,
      createdAt: s.createdAt,
    })),
  };
}
