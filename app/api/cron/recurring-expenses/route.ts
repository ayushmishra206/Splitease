import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyGroupMembers } from "@/lib/push";
import { computeNextOccurrence } from "@/lib/expenses-shared";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueExpenses = await prisma.expense.findMany({
    where: {
      isRecurring: true,
      nextOccurrence: { lte: now },
      group: { status: "active" },
    },
    include: {
      splits: true,
      payers: true,
      group: {
        select: {
          name: true,
          currency: true,
          members: { select: { memberId: true } },
        },
      },
    },
  });

  let created = 0;
  for (const expense of dueExpenses) {
    if (!expense.nextOccurrence || !expense.recurrenceRule) continue;

    // Create the new occurrence dated on the scheduled day, not when the cron ran
    const occurrenceDate = new Date(expense.nextOccurrence);
    const memberIds = new Set(expense.group.members.map((m) => m.memberId));
    const splits = expense.splits.filter((s) => memberIds.has(s.memberId));
    if (splits.length === 0) continue;

    await prisma.$transaction([
      prisma.expense.create({
        data: {
          groupId: expense.groupId,
          payerId: expense.payerId,
          createdById: expense.createdById,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          splitType: expense.splitType,
          expenseDate: occurrenceDate,
          notes: expense.notes,
          splits: { create: splits.map((s) => ({ memberId: s.memberId, share: s.share })) },
          payers: {
            create: expense.payers
              .filter((p) => memberIds.has(p.memberId))
              .map((p) => ({ memberId: p.memberId, amount: p.amount })),
          },
        },
      }),
      prisma.expense.update({
        where: { id: expense.id },
        data: { nextOccurrence: computeNextOccurrence(occurrenceDate, expense.recurrenceRule) },
      }),
      prisma.activityLog.create({
        data: {
          groupId: expense.groupId,
          userId: expense.createdById ?? expense.payerId ?? [...memberIds][0],
          action: "created",
          entityType: "expense",
          description: `Recurring expense "${expense.description}" — ${parseFloat(String(expense.amount)).toFixed(2)} ${expense.group.currency}`,
        },
      }),
    ]);

    const amountStr = parseFloat(String(expense.amount)).toFixed(2);
    void notifyGroupMembers("", [...memberIds], {
      title: `Recurring expense in ${expense.group.name}`,
      body: `"${expense.description}" — ${amountStr} ${expense.group.currency}`,
      url: `/groups/${expense.groupId}`,
    });

    created++;
  }

  return NextResponse.json({ created });
}
