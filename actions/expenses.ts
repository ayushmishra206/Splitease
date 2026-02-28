"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function fetchExpenses(groupId?: string) {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  return prisma.expense.findMany({
    where: {
      groupId: groupId && groupIds.includes(groupId) ? groupId : { in: groupIds },
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
    orderBy: { expenseDate: "desc" },
  });
}

export async function createExpense(input: {
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  expenseDate: string;
  notes?: string;
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
      payerId: input.payerId,
      expenseDate: new Date(input.expenseDate),
      notes: input.notes,
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

  revalidatePath("/expenses");
  revalidatePath("/");
  return expense;
}

export async function updateExpense(input: {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  expenseDate: string;
  notes?: string;
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
        payerId: input.payerId,
        expenseDate: new Date(input.expenseDate),
        notes: input.notes,
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
  return expense;
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
