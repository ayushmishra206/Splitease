"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export type AnalyticsData = {
  monthlySpending: Array<{ month: string; total: number }>;
  categoryBreakdown: Array<{ category: string; total: number }>;
  groupComparison: Array<{ groupId: string; groupName: string; total: number }>;
  topSpenders: Array<{ userId: string; userName: string; total: number }>;
};

export async function fetchAnalyticsData(groupId?: string): Promise<AnalyticsData> {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const memberGroupIds = memberships.map((m) => m.groupId);
  const groupIds = groupId
    ? memberGroupIds.includes(groupId) ? [groupId] : []
    : memberGroupIds;

  if (groupIds.length === 0) {
    return { monthlySpending: [], categoryBreakdown: [], groupComparison: [], topSpenders: [] };
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId: { in: groupIds } },
    include: {
      group: { select: { id: true, name: true } },
      payer: { select: { id: true, fullName: true } },
    },
    orderBy: { expenseDate: "asc" },
  });

  // Monthly spending (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const monthlyMap = new Map<string, number>();
  for (const e of expenses) {
    const date = new Date(e.expenseDate);
    if (date < sixMonthsAgo) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + parseFloat(String(e.amount)));
  }
  const monthlySpending = Array.from(monthlyMap.entries())
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Category breakdown
  const catMap = new Map<string, number>();
  for (const e of expenses) {
    const cat = e.category ?? "other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + parseFloat(String(e.amount)));
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  // Group comparison
  const groupMap = new Map<string, { name: string; total: number }>();
  for (const e of expenses) {
    const existing = groupMap.get(e.group.id) ?? { name: e.group.name, total: 0 };
    existing.total += parseFloat(String(e.amount));
    groupMap.set(e.group.id, existing);
  }
  const groupComparison = Array.from(groupMap.entries())
    .map(([gId, { name, total }]) => ({ groupId: gId, groupName: name, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  // Top spenders
  const spenderMap = new Map<string, { name: string; total: number }>();
  for (const e of expenses) {
    if (!e.payer) continue;
    const existing = spenderMap.get(e.payer.id) ?? { name: e.payer.fullName ?? "Unknown", total: 0 };
    existing.total += parseFloat(String(e.amount));
    spenderMap.set(e.payer.id, existing);
  }
  const topSpenders = Array.from(spenderMap.entries())
    .map(([uId, { name, total }]) => ({ userId: uId, userName: name, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return { monthlySpending, categoryBreakdown, groupComparison, topSpenders };
}
