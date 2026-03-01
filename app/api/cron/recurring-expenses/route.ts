import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyGroupMembers } from "@/lib/push";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueExpenses = await prisma.expense.findMany({
    where: {
      isRecurring: true,
      nextOccurrence: { lte: now },
    },
    include: {
      splits: true,
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
    // Create duplicate expense
    await prisma.expense.create({
      data: {
        groupId: expense.groupId,
        payerId: expense.payerId,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        splitType: expense.splitType,
        expenseDate: now,
        notes: expense.notes,
        splits: {
          create: expense.splits.map((s) => ({
            memberId: s.memberId,
            share: s.share,
          })),
        },
      },
    });

    // Notify all group members about the recurring expense
    const memberIds = expense.group.members.map((m) => m.memberId);
    const amountStr = parseFloat(String(expense.amount)).toFixed(2);
    void notifyGroupMembers("", memberIds, {
      title: `Recurring expense in ${expense.group.name}`,
      body: `"${expense.description}" — ${amountStr} ${expense.group.currency}`,
      url: `/groups/${expense.groupId}`,
    });

    // Compute next occurrence
    const nextDate = new Date(expense.nextOccurrence!);
    switch (expense.recurrenceRule) {
      case "weekly": nextDate.setDate(nextDate.getDate() + 7); break;
      case "biweekly": nextDate.setDate(nextDate.getDate() + 14); break;
      case "monthly": nextDate.setMonth(nextDate.getMonth() + 1); break;
      case "yearly": nextDate.setFullYear(nextDate.getFullYear() + 1); break;
    }

    await prisma.expense.update({
      where: { id: expense.id },
      data: { nextOccurrence: nextDate },
    });

    created++;
  }

  return NextResponse.json({ created });
}
