"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmailSafe } from "@/lib/email/send";
import { expenseAddedEmail } from "@/lib/email/templates";
import { sendPushNotification } from "@/lib/push";

function computeNextOccurrence(date: Date, rule: string): Date {
  const next = new Date(date);
  switch (rule) {
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "biweekly": next.setDate(next.getDate() + 14); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "yearly": next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

export async function fetchExpenses(groupId?: string, cursor?: string, limit = 20) {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const expenses = await prisma.expense.findMany({
    where: {
      groupId: groupId && groupIds.includes(groupId) ? groupId : { in: groupIds },
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      payer: { select: { id: true, fullName: true, avatarUrl: true } },
      splits: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = expenses.length > limit;
  const items = (hasMore ? expenses.slice(0, limit) : expenses).map((e) => ({
    ...e,
    amount: parseFloat(String(e.amount)),
    splits: e.splits.map((s) => ({
      ...s,
      share: parseFloat(String(s.share)),
    })),
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

export async function createExpense(input: {
  groupId: string;
  description: string;
  amount: number;
  category?: string;
  splitType?: string;
  payerId: string;
  expenseDate: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  receiptUrl?: string;
  splits: { memberId: string; share: number }[];
}) {
  const user = await getAuthenticatedUser();

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: input.groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  const expense = await prisma.expense.create({
    data: {
      groupId: input.groupId,
      description: input.description,
      amount: input.amount,
      category: input.category,
      splitType: input.splitType ?? "equal",
      payerId: input.payerId,
      createdById: user.id,
      expenseDate: new Date(input.expenseDate),
      notes: input.notes,
      receiptUrl: input.receiptUrl,
      isRecurring: input.isRecurring ?? false,
      recurrenceRule: input.isRecurring ? input.recurrenceRule : null,
      nextOccurrence: input.isRecurring && input.recurrenceRule
        ? computeNextOccurrence(new Date(input.expenseDate), input.recurrenceRule)
        : null,
      splits: {
        create: input.splits.map((s) => ({
          memberId: s.memberId,
          share: s.share,
        })),
      },
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      payer: { select: { id: true, fullName: true, avatarUrl: true } },
      splits: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  });

  // Notify group members (excluding the payer)
  const payerName = expense.payer?.fullName ?? "Someone";
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: input.groupId },
    include: { member: { select: { id: true, email: true, fullName: true } } },
  });
  for (const gm of groupMembers) {
    if (gm.member.id === input.payerId) continue;
    sendEmailSafe(
      gm.member.email,
      `New expense in ${expense.group.name}`,
      expenseAddedEmail(
        gm.member.fullName ?? "there",
        expense.description,
        parseFloat(String(expense.amount)).toFixed(2),
        expense.group.currency,
        expense.group.name,
        payerName
      )
    );
  }

  // Send push notifications
  const pushSubs = await prisma.pushSubscription.findMany({
    where: {
      userId: {
        in: groupMembers
          .filter((gm) => gm.member.id !== input.payerId)
          .map((gm) => gm.member.id),
      },
    },
  });
  for (const sub of pushSubs) {
    void sendPushNotification(sub, {
      title: `New expense in ${expense.group.name}`,
      body: `${payerName} added "${expense.description}" — ${parseFloat(String(expense.amount)).toFixed(2)} ${expense.group.currency}`,
      url: `/groups/${input.groupId}`,
    });
  }

  // Log activity
  void prisma.activityLog.create({
    data: {
      groupId: input.groupId,
      userId: user.id,
      action: "created",
      entityType: "expense",
      description: `Added "${expense.description}" — ${parseFloat(String(expense.amount)).toFixed(2)} ${expense.group.currency}`,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/");
  return {
    ...expense,
    amount: parseFloat(String(expense.amount)),
    splits: expense.splits.map((s) => ({
      ...s,
      share: parseFloat(String(s.share)),
    })),
  };
}

export async function updateExpense(input: {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  category?: string;
  splitType?: string;
  payerId: string;
  expenseDate: string;
  notes?: string;
  receiptUrl?: string;
  splits: { memberId: string; share: number }[];
}) {
  const user = await getAuthenticatedUser();

  const existing = await prisma.expense.findUnique({
    where: { id: input.id },
    select: { createdById: true, payerId: true },
  });
  if (!existing) throw new Error("Expense not found");

  const isCreator = existing.createdById === user.id || existing.payerId === user.id;
  if (!isCreator) throw new Error("Only the expense creator can edit this expense");

  const expense = await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId: input.id } });

    return tx.expense.update({
      where: { id: input.id },
      data: {
        groupId: input.groupId,
        description: input.description,
        amount: input.amount,
        category: input.category,
        splitType: input.splitType ?? "equal",
        payerId: input.payerId,
        expenseDate: new Date(input.expenseDate),
        notes: input.notes,
        receiptUrl: input.receiptUrl,
        splits: {
          create: input.splits.map((s) => ({
            memberId: s.memberId,
            share: s.share,
          })),
        },
      },
      include: {
        group: { select: { id: true, name: true, currency: true } },
        payer: { select: { id: true, fullName: true, avatarUrl: true } },
        splits: {
          include: {
            member: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });
  });

  // Log activity
  void prisma.activityLog.create({
    data: {
      groupId: input.groupId,
      userId: user.id,
      action: "updated",
      entityType: "expense",
      description: `Updated "${expense.description}" — ${parseFloat(String(expense.amount)).toFixed(2)} ${expense.group.currency}`,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/");
  return {
    ...expense,
    amount: parseFloat(String(expense.amount)),
    splits: expense.splits.map((s) => ({
      ...s,
      share: parseFloat(String(s.share)),
    })),
  };
}

export async function deleteExpense(id: string) {
  const user = await getAuthenticatedUser();

  const expense = await prisma.expense.findUnique({
    where: { id },
    select: {
      createdById: true,
      payerId: true,
      groupId: true,
      description: true,
      amount: true,
      group: { select: { currency: true } },
    },
  });
  if (!expense) throw new Error("Expense not found");

  const isCreator = expense.createdById === user.id || expense.payerId === user.id;
  if (!isCreator) throw new Error("Only the expense creator can delete this expense");

  // Log activity before deleting
  await prisma.activityLog.create({
    data: {
      groupId: expense.groupId,
      userId: user.id,
      action: "deleted",
      entityType: "expense",
      description: `Deleted "${expense.description}" — ${parseFloat(String(expense.amount)).toFixed(2)} ${expense.group.currency}`,
    },
  });

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/");
}
