"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { expenseAddedEmail } from "@/lib/email/templates";

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

  // Notify group members (excluding the payer)
  const payerName = expense.payer?.fullName ?? "Someone";
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: input.groupId },
    include: { member: { select: { id: true, email: true, fullName: true } } },
  });
  for (const gm of groupMembers) {
    if (gm.member.id === input.payerId) continue;
    void sendEmail(
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

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: input.groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

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
    include: { group: { include: { members: true } } },
  });
  if (!expense) throw new Error("Expense not found");

  const isMember = expense.group.members.some((m) => m.memberId === user.id);
  if (!isMember) throw new Error("Not authorized");

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/");
}
