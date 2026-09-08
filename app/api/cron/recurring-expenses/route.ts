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
  let stopped = 0;
  for (const expense of dueExpenses) {
    if (!expense.nextOccurrence || !expense.recurrenceRule) continue;

    // Create the new occurrence dated on the scheduled day, not when the cron ran
    const occurrenceDate = new Date(expense.nextOccurrence);
    const memberIds = new Set(expense.group.members.map((m) => m.memberId));
    const amountStr = parseFloat(String(expense.amount)).toFixed(2);

    // A copy is only valid when every participant and payer is still in the
    // group; dropping anyone would leave splits that no longer sum to the
    // amount. Stop the recurrence instead and tell the group why.
    const everyoneStillHere =
      expense.splits.length > 0 &&
      expense.splits.every((s) => memberIds.has(s.memberId)) &&
      expense.payers.every((p) => memberIds.has(p.memberId)) &&
      (expense.payers.length > 0 || (expense.payerId !== null && memberIds.has(expense.payerId)));
    const actorId = expense.createdById ?? expense.payerId ?? [...memberIds][0];

    if (!everyoneStillHere) {
      await prisma.$transaction([
        prisma.expense.update({
          where: { id: expense.id },
          data: { isRecurring: false, nextOccurrence: null },
        }),
        ...(actorId
          ? [
              prisma.activityLog.create({
                data: {
                  groupId: expense.groupId,
                  userId: actorId,
                  action: "updated",
                  entityType: "expense",
                  description: `Stopped repeating "${expense.description}" because a participant or payer is no longer in the group`,
                },
              }),
            ]
          : []),
      ]);
      stopped++;
      continue;
    }

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
          splits: { create: expense.splits.map((s) => ({ memberId: s.memberId, share: s.share })) },
          payers: { create: expense.payers.map((p) => ({ memberId: p.memberId, amount: p.amount })) },
        },
      }),
      prisma.expense.update({
        where: { id: expense.id },
        data: { nextOccurrence: computeNextOccurrence(occurrenceDate, expense.recurrenceRule) },
      }),
      prisma.activityLog.create({
        data: {
          groupId: expense.groupId,
          userId: actorId ?? expense.splits[0].memberId,
          action: "created",
          entityType: "expense",
          description: `Recurring expense "${expense.description}" — ${parseFloat(String(expense.amount)).toFixed(2)} ${expense.group.currency}`,
        },
      }),
    ]);

    void notifyGroupMembers("", [...memberIds], {
      title: `Recurring expense in ${expense.group.name}`,
      body: `"${expense.description}" — ${amountStr} ${expense.group.currency}`,
      url: `/groups/${expense.groupId}`,
    });

    created++;
  }

  return NextResponse.json({ created, stopped });
}
