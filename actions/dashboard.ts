"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export type BalanceEntry = {
  memberId: string;
  memberName: string;
  amount: number; // positive = they owe you, negative = you owe them
};

export type GroupSummary = {
  id: string;
  name: string;
  currency: string;
  totalExpenses: number;
  balances: BalanceEntry[];
  memberNames: string[];
  lastActivity: Date | null;
};

export type DashboardData = {
  totalGroups: number;
  totalExpenses: number;
  totalSettlements: number;
  youOwe: number;
  youAreOwed: number;
  recentExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    groupName: string;
    payerName: string;
    payerId: string;
    expenseDate: Date;
  }>;
  groupSummaries: GroupSummary[];
};

export async function fetchDashboardData(): Promise<DashboardData> {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const [groups, expenses, settlements] = await Promise.all([
    prisma.group.findMany({
      where: { id: { in: groupIds } },
      select: { id: true, name: true, currency: true },
    }),
    prisma.expense.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: { select: { id: true, name: true, currency: true } },
        payer: { select: { id: true, fullName: true } },
        splits: {
          include: { member: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.settlement.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        from: { select: { id: true, fullName: true } },
        to: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  // Calculate net balances per group
  // For each group, track balances[memberId] relative to current user
  const groupSummaries: GroupSummary[] = [];
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;

  for (const group of groups) {
    const groupExpenses = expenses.filter((e) => e.groupId === group.id);
    const groupSettlements = settlements.filter((s) => s.groupId === group.id);

    // net[memberId] = how much memberId owes current user
    // positive = they owe me, negative = I owe them
    const net: Record<string, number> = {};

    for (const expense of groupExpenses) {
      const payerId = expense.payerId;
      for (const split of expense.splits) {
        const share = parseFloat(String(split.share));
        if (payerId === user.id && split.memberId !== user.id) {
          // I paid, they owe me their share
          net[split.memberId] = (net[split.memberId] ?? 0) + share;
        } else if (payerId !== user.id && split.memberId === user.id) {
          // They paid, I owe them my share
          net[payerId] = (net[payerId] ?? 0) - share;
        }
      }
    }

    for (const settlement of groupSettlements) {
      const amount = parseFloat(String(settlement.amount));
      if (settlement.fromMember === user.id) {
        // I paid them, reduce what I owe
        net[settlement.toMember] = (net[settlement.toMember] ?? 0) + amount;
      } else if (settlement.toMember === user.id) {
        // They paid me, reduce what they owe
        net[settlement.fromMember] = (net[settlement.fromMember] ?? 0) - amount;
      }
    }

    // Collect member names
    const memberNames: Record<string, string> = {};
    for (const expense of groupExpenses) {
      memberNames[expense.payerId] = expense.payer.fullName ?? "Unknown";
      for (const split of expense.splits) {
        memberNames[split.memberId] = split.member.fullName ?? "Unknown";
      }
    }

    const balances: BalanceEntry[] = Object.entries(net)
      .filter(([, amount]) => Math.abs(amount) > 0.01)
      .map(([memberId, amount]) => ({
        memberId,
        memberName: memberNames[memberId] ?? "Unknown",
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    const totalExp = groupExpenses.reduce(
      (sum, e) => sum + parseFloat(String(e.amount)),
      0
    );

    for (const b of balances) {
      if (b.amount > 0) totalYouAreOwed += b.amount;
      else totalYouOwe += Math.abs(b.amount);
    }

    const lastExpense = groupExpenses[0];
    const lastSettlement = groupSettlements.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const lastActivity = lastExpense?.createdAt
      ? lastSettlement?.createdAt
        ? new Date(Math.max(
            new Date(lastExpense.createdAt).getTime(),
            new Date(lastSettlement.createdAt).getTime()
          ))
        : new Date(lastExpense.createdAt)
      : lastSettlement?.createdAt
        ? new Date(lastSettlement.createdAt)
        : null;

    groupSummaries.push({
      id: group.id,
      name: group.name,
      currency: group.currency,
      totalExpenses: Math.round(totalExp * 100) / 100,
      balances,
      memberNames: Object.values(memberNames),
      lastActivity,
    });
  }

  const recentExpenses = expenses.slice(0, 5).map((e) => ({
    id: e.id,
    description: e.description,
    amount: parseFloat(String(e.amount)),
    currency: e.group.currency,
    groupName: e.group.name,
    payerName: e.payer.fullName ?? "Unknown",
    payerId: e.payerId,
    expenseDate: e.expenseDate,
  }));

  return {
    totalGroups: groups.length,
    totalExpenses: expenses.length,
    totalSettlements: settlements.length,
    youOwe: Math.round(totalYouOwe * 100) / 100,
    youAreOwed: Math.round(totalYouAreOwed * 100) / 100,
    recentExpenses,
    groupSummaries,
  };
}
