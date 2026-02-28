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

  if (groupIds.length === 0) {
    return {
      totalGroups: 0,
      totalExpenses: 0,
      totalSettlements: 0,
      youOwe: 0,
      youAreOwed: 0,
      recentExpenses: [],
      groupSummaries: [],
    };
  }

  // Fetch everything in parallel — groups, balance data, recent expenses, counts
  const [groups, expenseSplits, settlements, recentExpenses, expenseCount, settlementCount] =
    await Promise.all([
      // Groups with member names
      prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: {
          id: true,
          name: true,
          currency: true,
          members: {
            select: { member: { select: { id: true, fullName: true } } },
          },
        },
      }),
      // Only the fields needed for balance calculation (no full includes)
      prisma.expenseSplit.findMany({
        where: { expense: { groupId: { in: groupIds } } },
        select: {
          memberId: true,
          share: true,
          expense: {
            select: {
              groupId: true,
              payerId: true,
              amount: true,
            },
          },
        },
      }),
      // Settlements — minimal fields for balance calc
      prisma.settlement.findMany({
        where: { groupId: { in: groupIds } },
        select: {
          groupId: true,
          fromMember: true,
          toMember: true,
          amount: true,
          createdAt: true,
        },
      }),
      // Only 5 recent expenses with display data
      prisma.expense.findMany({
        where: { groupId: { in: groupIds } },
        select: {
          id: true,
          description: true,
          amount: true,
          expenseDate: true,
          payerId: true,
          groupId: true,
          createdAt: true,
          payer: { select: { fullName: true } },
          group: { select: { name: true, currency: true } },
        },
        orderBy: { expenseDate: "desc" },
        take: 5,
      }),
      // Counts (fast aggregate, no data transfer)
      prisma.expense.count({ where: { groupId: { in: groupIds } } }),
      prisma.settlement.count({ where: { groupId: { in: groupIds } } }),
    ]);

  // Build member name lookup from groups
  const memberNamesByGroup: Record<string, Record<string, string>> = {};
  for (const group of groups) {
    memberNamesByGroup[group.id] = {};
    for (const gm of group.members) {
      memberNamesByGroup[group.id][gm.member.id] = gm.member.fullName ?? "Unknown";
    }
  }

  // Calculate net balances per group
  const groupSummaries: GroupSummary[] = [];
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;

  // Pre-index splits and settlements by groupId
  const splitsByGroup: Record<string, typeof expenseSplits> = {};
  for (const split of expenseSplits) {
    const gid = split.expense.groupId;
    (splitsByGroup[gid] ??= []).push(split);
  }

  const settlementsByGroup: Record<string, typeof settlements> = {};
  for (const s of settlements) {
    (settlementsByGroup[s.groupId] ??= []).push(s);
  }

  for (const group of groups) {
    const groupSplits = splitsByGroup[group.id] ?? [];
    const groupSettlements = settlementsByGroup[group.id] ?? [];
    const memberNames = memberNamesByGroup[group.id] ?? {};

    // net[memberId] = how much memberId owes current user
    const net: Record<string, number> = {};
    let totalExp = 0;

    // Track unique expense amounts for total calculation
    const seenExpenses = new Set<string>();

    for (const split of groupSplits) {
      const payerId = split.expense.payerId;
      if (!payerId) continue;
      const share = parseFloat(String(split.share));

      // Track total expenses (deduplicate by expense)
      const expKey = `${payerId}-${split.expense.amount}`;
      if (!seenExpenses.has(expKey)) {
        // We don't have expense ID here, use a different approach
      }

      if (payerId === user.id && split.memberId !== user.id) {
        net[split.memberId] = (net[split.memberId] ?? 0) + share;
      } else if (payerId !== user.id && split.memberId === user.id) {
        net[payerId] = (net[payerId] ?? 0) - share;
      }
    }

    // Calculate total expenses from splits (sum of all shares = total amount)
    for (const split of groupSplits) {
      totalExp += parseFloat(String(split.share));
    }

    for (const settlement of groupSettlements) {
      const amount = parseFloat(String(settlement.amount));
      if (settlement.fromMember === user.id) {
        net[settlement.toMember] = (net[settlement.toMember] ?? 0) + amount;
      } else if (settlement.toMember === user.id) {
        net[settlement.fromMember] = (net[settlement.fromMember] ?? 0) - amount;
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

    for (const b of balances) {
      if (b.amount > 0) totalYouAreOwed += b.amount;
      else totalYouOwe += Math.abs(b.amount);
    }

    // Last activity
    const lastSettlement = groupSettlements.length > 0
      ? groupSettlements.reduce((latest, s) =>
          new Date(s.createdAt) > new Date(latest.createdAt) ? s : latest
        )
      : null;

    // Find most recent expense date from recentExpenses if it's in this group
    const lastExpenseInGroup = recentExpenses.find((e) => e.groupId === group.id);
    const lastActivity = lastExpenseInGroup?.createdAt
      ? lastSettlement?.createdAt
        ? new Date(Math.max(
            new Date(lastExpenseInGroup.createdAt).getTime(),
            new Date(lastSettlement.createdAt).getTime(),
          ))
        : new Date(lastExpenseInGroup.createdAt)
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

  return {
    totalGroups: groups.length,
    totalExpenses: expenseCount,
    totalSettlements: settlementCount,
    youOwe: Math.round(totalYouOwe * 100) / 100,
    youAreOwed: Math.round(totalYouAreOwed * 100) / 100,
    recentExpenses: recentExpenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: parseFloat(String(e.amount)),
      currency: e.group.currency,
      groupName: e.group.name,
      payerName: e.payer?.fullName ?? "Unknown",
      payerId: e.payerId ?? "",
      expenseDate: e.expenseDate,
    })),
    groupSummaries,
  };
}
