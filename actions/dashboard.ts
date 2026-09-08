"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { roundMoney, toNumber } from "@/lib/money";
import { balancesForUser, computeNetBalances } from "@/lib/simplify-debts";

export type BalanceEntry = {
  memberId: string;
  memberName: string;
  amount: number; // positive = they owe you, negative = you owe them
};

export type GroupSummary = {
  id: string;
  name: string;
  currency: string;
  /** Sum of all expenses in the group. */
  totalExpenses: number;
  /** Sum of the current user's shares in the group. */
  yourShare: number;
  expenseCount: number;
  /** Net for the current user in this group (positive = owed to you). */
  netBalance: number;
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
  /** Total the current user is responsible for across all active groups. */
  yourTotalShare: number;
  primaryCurrency: string;
  /** True when active groups use more than one currency (totals are then approximate). */
  mixedCurrencies: boolean;
  recentExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string | null;
    currency: string;
    groupId: string;
    groupName: string;
    payerName: string;
    payerId: string;
    payerCount: number;
    expenseDate: Date;
  }>;
  groupSummaries: GroupSummary[];
};

const EMPTY: DashboardData = {
  totalGroups: 0,
  totalExpenses: 0,
  totalSettlements: 0,
  youOwe: 0,
  youAreOwed: 0,
  yourTotalShare: 0,
  primaryCurrency: "USD",
  mixedCurrencies: false,
  recentExpenses: [],
  groupSummaries: [],
};

export async function fetchDashboardData(): Promise<DashboardData> {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);
  if (groupIds.length === 0) return EMPTY;

  const [groups, expenses, settlements, recentExpenses, expenseCount, settlementCount] =
    await Promise.all([
      prisma.group.findMany({
        where: { id: { in: groupIds }, status: "active" },
        select: {
          id: true,
          name: true,
          currency: true,
          members: { select: { member: { select: { id: true, fullName: true } } } },
        },
      }),
      prisma.expense.findMany({
        where: { groupId: { in: groupIds } },
        select: {
          groupId: true,
          payerId: true,
          amount: true,
          createdAt: true,
          payers: { select: { memberId: true, amount: true } },
          splits: { select: { memberId: true, share: true } },
        },
      }),
      prisma.settlement.findMany({
        where: { groupId: { in: groupIds } },
        select: { groupId: true, fromMember: true, toMember: true, amount: true, createdAt: true },
      }),
      prisma.expense.findMany({
        where: { groupId: { in: groupIds } },
        select: {
          id: true,
          description: true,
          amount: true,
          category: true,
          expenseDate: true,
          payerId: true,
          groupId: true,
          payer: { select: { fullName: true } },
          payers: { select: { memberId: true, member: { select: { fullName: true } } }, orderBy: { amount: "desc" } },
          group: { select: { name: true, currency: true } },
        },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      prisma.expense.count({ where: { groupId: { in: groupIds } } }),
      prisma.settlement.count({ where: { groupId: { in: groupIds } } }),
    ]);

  const expensesByGroup = new Map<string, typeof expenses>();
  for (const e of expenses) {
    const list = expensesByGroup.get(e.groupId) ?? [];
    list.push(e);
    expensesByGroup.set(e.groupId, list);
  }
  const settlementsByGroup = new Map<string, typeof settlements>();
  for (const s of settlements) {
    const list = settlementsByGroup.get(s.groupId) ?? [];
    list.push(s);
    settlementsByGroup.set(s.groupId, list);
  }

  const groupSummaries: GroupSummary[] = [];
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;
  let yourTotalShare = 0;

  for (const group of groups) {
    const memberNames: Record<string, string> = {};
    for (const gm of group.members) memberNames[gm.member.id] = gm.member.fullName ?? "Unknown";

    const groupExpenses = expensesByGroup.get(group.id) ?? [];
    const groupSettlements = settlementsByGroup.get(group.id) ?? [];

    const balanceExpenses = groupExpenses.map((e) => ({
      payerId: e.payerId,
      amount: toNumber(e.amount),
      payers: e.payers.map((p) => ({ memberId: p.memberId, amount: toNumber(p.amount) })),
      splits: e.splits.map((s) => ({ memberId: s.memberId, share: toNumber(s.share) })),
    }));
    const balanceSettlements = groupSettlements.map((s) => ({
      fromMember: s.fromMember,
      toMember: s.toMember,
      amount: toNumber(s.amount),
    }));

    const net = computeNetBalances(balanceExpenses, balanceSettlements);
    const netBalance = roundMoney(net[user.id] ?? 0);
    const balances: BalanceEntry[] = balancesForUser(net, user.id).map((b) => ({
      memberId: b.memberId,
      memberName: memberNames[b.memberId] ?? "Former member",
      amount: b.amount,
    }));

    if (netBalance > 0) totalYouAreOwed += netBalance;
    else totalYouOwe += Math.abs(netBalance);

    let totalExpenses = 0;
    let yourShare = 0;
    let lastActivityTime = 0;
    for (const e of balanceExpenses) totalExpenses += e.amount;
    for (const e of balanceExpenses) {
      for (const s of e.splits) if (s.memberId === user.id) yourShare += s.share;
    }
    for (const e of groupExpenses) lastActivityTime = Math.max(lastActivityTime, e.createdAt.getTime());
    for (const s of groupSettlements) lastActivityTime = Math.max(lastActivityTime, s.createdAt.getTime());
    yourTotalShare += yourShare;

    groupSummaries.push({
      id: group.id,
      name: group.name,
      currency: group.currency,
      totalExpenses: roundMoney(totalExpenses),
      yourShare: roundMoney(yourShare),
      expenseCount: groupExpenses.length,
      netBalance,
      balances,
      memberNames: Object.values(memberNames),
      lastActivity: lastActivityTime > 0 ? new Date(lastActivityTime) : null,
    });
  }

  groupSummaries.sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0));

  const currencyCounts: Record<string, number> = {};
  for (const g of groups) currencyCounts[g.currency] = (currencyCounts[g.currency] ?? 0) + 1;
  const primaryCurrency =
    Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  return {
    totalGroups: groups.length,
    totalExpenses: expenseCount,
    totalSettlements: settlementCount,
    youOwe: roundMoney(totalYouOwe),
    youAreOwed: roundMoney(totalYouAreOwed),
    yourTotalShare: roundMoney(yourTotalShare),
    primaryCurrency,
    mixedCurrencies: Object.keys(currencyCounts).length > 1,
    recentExpenses: recentExpenses.map((e) => {
      const primary = e.payers[0];
      return {
        id: e.id,
        description: e.description,
        amount: toNumber(e.amount),
        category: e.category,
        currency: e.group.currency,
        groupId: e.groupId,
        groupName: e.group.name,
        payerName: primary?.member.fullName ?? e.payer?.fullName ?? "Unknown",
        payerId: primary?.memberId ?? e.payerId ?? "",
        payerCount: Math.max(e.payers.length, e.payerId ? 1 : 0),
        expenseDate: e.expenseDate,
      };
    }),
    groupSummaries,
  };
}
