"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmailSafe } from "@/lib/email/send";
import { expenseAddedEmail } from "@/lib/email/templates";
import { notifyGroupMembers } from "@/lib/push";
import { toNumber } from "@/lib/money";
import { expenseInputSchema, parseOrThrow, uuid } from "@/lib/validation";
import { computeNextOccurrence, normalizePayers } from "@/lib/expenses-shared";

const expenseInclude = {
  group: { select: { id: true, name: true, currency: true, ownerId: true } },
  payer: { select: { id: true, fullName: true, avatarUrl: true } },
  createdBy: { select: { id: true, fullName: true } },
  payers: {
    include: { member: { select: { id: true, fullName: true, avatarUrl: true } } },
    orderBy: { amount: "desc" as const },
  },
  splits: {
    include: { member: { select: { id: true, fullName: true, avatarUrl: true } } },
  },
} as const;

type ExpenseRow = {
  id: string;
  groupId: string;
  payerId: string | null;
  createdById: string | null;
  description: string;
  amount: unknown;
  category: string | null;
  splitType: string;
  expenseDate: Date;
  notes: string | null;
  receiptUrl: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: Date;
  updatedAt: Date;
  group: { id: string; name: string; currency: string; ownerId: string };
  payer: { id: string; fullName: string | null; avatarUrl: string | null } | null;
  createdBy: { id: string; fullName: string | null } | null;
  payers: Array<{
    id: string;
    memberId: string;
    amount: unknown;
    member: { id: string; fullName: string | null; avatarUrl: string | null };
  }>;
  splits: Array<{
    id: string;
    expenseId: string;
    memberId: string;
    share: unknown;
    member: { id: string; fullName: string | null; avatarUrl: string | null };
  }>;
};

/** Convert Prisma Decimals to numbers and expose a normalised `payers` list. */
function serializeExpense(e: ExpenseRow) {
  const amount = toNumber(e.amount);
  const storedPayers = e.payers.map((p) => ({
    id: p.id,
    memberId: p.memberId,
    amount: toNumber(p.amount),
    member: p.member,
  }));
  const payers =
    storedPayers.length > 0
      ? storedPayers
      : e.payer
        ? [{ id: `legacy-${e.id}`, memberId: e.payer.id, amount, member: e.payer }]
        : [];
  return {
    id: e.id,
    groupId: e.groupId,
    payerId: e.payerId,
    createdById: e.createdById,
    description: e.description,
    amount,
    category: e.category,
    splitType: e.splitType,
    expenseDate: e.expenseDate,
    notes: e.notes,
    receiptUrl: e.receiptUrl,
    isRecurring: e.isRecurring,
    recurrenceRule: e.recurrenceRule,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    group: e.group,
    payer: e.payer,
    createdBy: e.createdBy,
    payers,
    splits: e.splits.map((s) => ({
      id: s.id,
      expenseId: s.expenseId,
      memberId: s.memberId,
      share: toNumber(s.share),
      member: s.member,
    })),
  };
}

export type ExpenseWithDetails = ReturnType<typeof serializeExpense>;

export async function fetchExpenses(groupId?: string, cursor?: string, limit = 20) {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const cursorDate = cursor ? new Date(cursor) : null;
  const expenses = await prisma.expense.findMany({
    where: {
      groupId: groupId && groupIds.includes(groupId) ? groupId : { in: groupIds },
      ...(cursorDate && !Number.isNaN(cursorDate.getTime())
        ? { createdAt: { lt: cursorDate } }
        : {}),
    },
    include: expenseInclude,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = expenses.length > limit;
  const items = (hasMore ? expenses.slice(0, limit) : expenses).map(serializeExpense);

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

/**
 * Validate that the group is active, the caller is a member, and every payer
 * and participant belongs to the group.
 */
async function assertGroupWritable(
  groupId: string,
  userId: string,
  memberIdsToCheck: string[]
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      currency: true,
      status: true,
      members: { select: { memberId: true } },
    },
  });
  if (!group) throw new Error("Group not found");
  const memberIds = new Set(group.members.map((m) => m.memberId));
  if (!memberIds.has(userId)) throw new Error("Not a member of this group");
  if (group.status === "archived") throw new Error("This group is archived");
  for (const id of memberIdsToCheck) {
    if (!memberIds.has(id)) throw new Error("Payers and participants must be group members");
  }
  return group;
}

export async function createExpense(rawInput: unknown) {
  const user = await getAuthenticatedUser();
  const input = parseOrThrow(expenseInputSchema, rawInput);

  const { payers, primaryPayerId } = normalizePayers(input.payers, input.payerId, input.amount);

  const group = await assertGroupWritable(input.groupId, user.id, [
    ...payers.map((p) => p.memberId),
    ...input.splits.map((s) => s.memberId),
  ]);

  const expense = await prisma.expense.create({
    data: {
      groupId: input.groupId,
      description: input.description,
      amount: input.amount,
      category: input.category,
      splitType: input.splitType ?? "equal",
      payerId: primaryPayerId,
      createdById: user.id,
      expenseDate: new Date(input.expenseDate),
      notes: input.notes,
      receiptUrl: input.receiptUrl,
      isRecurring: input.isRecurring ?? false,
      recurrenceRule: input.isRecurring ? input.recurrenceRule : null,
      nextOccurrence:
        input.isRecurring && input.recurrenceRule
          ? computeNextOccurrence(new Date(input.expenseDate), input.recurrenceRule)
          : null,
      payers: { create: payers.map((p) => ({ memberId: p.memberId, amount: p.amount })) },
      splits: { create: input.splits.map((s) => ({ memberId: s.memberId, share: s.share })) },
    },
    include: expenseInclude,
  });

  const serialized = serializeExpense(expense);
  const amountStr = serialized.amount.toFixed(2);
  const payerName =
    serialized.payers.length > 1
      ? `${serialized.payers[0].member.fullName ?? "Someone"} and ${serialized.payers.length - 1} other${serialized.payers.length > 2 ? "s" : ""}`
      : (serialized.payers[0]?.member.fullName ?? "Someone");

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: input.groupId },
    include: { member: { select: { id: true, email: true, fullName: true } } },
  });
  const memberIds = groupMembers.map((gm) => gm.member.id);

  // Email only when the user opted in
  if (input.notifyByEmail) {
    for (const gm of groupMembers) {
      if (gm.member.id === user.id) continue;
      sendEmailSafe(
        gm.member.email,
        `New expense in ${group.name}`,
        expenseAddedEmail(
          gm.member.fullName ?? "there",
          expense.description,
          amountStr,
          group.currency,
          group.name,
          payerName
        )
      );
    }
  }

  void notifyGroupMembers(user.id, memberIds, {
    title: `New expense in ${group.name}`,
    body: `${payerName} added "${expense.description}" — ${amountStr} ${group.currency}`,
    url: `/groups/${input.groupId}`,
  });

  await prisma.activityLog.create({
    data: {
      groupId: input.groupId,
      userId: user.id,
      action: "created",
      entityType: "expense",
      description: `Added "${expense.description}" — ${amountStr} ${group.currency}`,
    },
  });

  revalidateExpensePaths(input.groupId);
  return serialized;
}

export async function updateExpense(rawInput: unknown) {
  const user = await getAuthenticatedUser();
  const id = parseOrThrow(uuid, (rawInput as { id?: unknown })?.id);
  const input = parseOrThrow(expenseInputSchema, rawInput);

  const existing = await prisma.expense.findUnique({
    where: { id },
    select: {
      groupId: true,
      createdById: true,
      payerId: true,
      description: true,
      isRecurring: true,
      recurrenceRule: true,
      group: { select: { members: { select: { memberId: true } } } },
    },
  });
  if (!existing) throw new Error("Expense not found");

  // Any member of the group can edit an expense (Splitwise-style); the group
  // an expense belongs to cannot be changed after the fact.
  const isMember = existing.group.members.some((m) => m.memberId === user.id);
  if (!isMember) throw new Error("Only group members can edit this expense");
  if (input.groupId !== existing.groupId) {
    throw new Error("An expense cannot be moved to another group");
  }

  const { payers, primaryPayerId } = normalizePayers(input.payers, input.payerId, input.amount);
  const group = await assertGroupWritable(existing.groupId, user.id, [
    ...payers.map((p) => p.memberId),
    ...input.splits.map((s) => s.memberId),
  ]);

  const expense = await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
    await tx.expensePayer.deleteMany({ where: { expenseId: id } });

    return tx.expense.update({
      where: { id },
      data: {
        description: input.description,
        amount: input.amount,
        category: input.category ?? null,
        splitType: input.splitType ?? "equal",
        payerId: primaryPayerId,
        expenseDate: new Date(input.expenseDate),
        notes: input.notes ?? null,
        receiptUrl: input.receiptUrl ?? null,
        ...(input.isRecurring !== undefined
          ? {
              isRecurring: input.isRecurring,
              recurrenceRule: input.isRecurring ? input.recurrenceRule : null,
              nextOccurrence:
                input.isRecurring && input.recurrenceRule
                  ? computeNextOccurrence(new Date(input.expenseDate), input.recurrenceRule)
                  : null,
            }
          : {}),
        payers: { create: payers.map((p) => ({ memberId: p.memberId, amount: p.amount })) },
        splits: { create: input.splits.map((s) => ({ memberId: s.memberId, share: s.share })) },
      },
      include: expenseInclude,
    });
  });

  const serialized = serializeExpense(expense);
  const editorName =
    (await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }))
      ?.fullName ?? "Someone";
  const editedOthersExpense = existing.createdById !== null && existing.createdById !== user.id;

  void notifyGroupMembers(user.id, existing.group.members.map((m) => m.memberId), {
    title: `Expense updated in ${group.name}`,
    body: editedOthersExpense
      ? `${editorName} edited "${expense.description}" (added by ${expense.createdBy?.fullName ?? "someone else"})`
      : `${editorName} updated "${expense.description}"`,
    url: `/groups/${existing.groupId}`,
  });

  await prisma.activityLog.create({
    data: {
      groupId: existing.groupId,
      userId: user.id,
      action: "updated",
      entityType: "expense",
      description: editedOthersExpense
        ? `Edited "${expense.description}" (added by ${expense.createdBy?.fullName ?? "someone else"}) — ${serialized.amount.toFixed(2)} ${group.currency}`
        : `Updated "${expense.description}" — ${serialized.amount.toFixed(2)} ${group.currency}`,
    },
  });

  revalidateExpensePaths(existing.groupId);
  return serialized;
}

export async function deleteExpense(rawId: unknown) {
  const user = await getAuthenticatedUser();
  const id = parseOrThrow(uuid, rawId);

  const expense = await prisma.expense.findUnique({
    where: { id },
    select: {
      createdById: true,
      payerId: true,
      groupId: true,
      description: true,
      amount: true,
      payers: { select: { memberId: true } },
      group: {
        select: {
          name: true,
          currency: true,
          ownerId: true,
          status: true,
          members: { select: { memberId: true } },
        },
      },
    },
  });
  if (!expense) throw new Error("Expense not found");
  if (expense.group.status === "archived") throw new Error("This group is archived");

  // Deleting is limited to the creator, anyone who paid, or the group owner.
  const paidBy = new Set(
    expense.payers.length > 0
      ? expense.payers.map((p) => p.memberId)
      : expense.payerId
        ? [expense.payerId]
        : []
  );
  const canDelete =
    expense.createdById === user.id ||
    paidBy.has(user.id) ||
    expense.group.ownerId === user.id;
  if (!canDelete) {
    throw new Error("Only the person who added or paid this expense, or the group owner, can delete it");
  }

  const amountStr = toNumber(expense.amount).toFixed(2);
  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        groupId: expense.groupId,
        userId: user.id,
        action: "deleted",
        entityType: "expense",
        description: `Deleted "${expense.description}" — ${amountStr} ${expense.group.currency}`,
      },
    }),
    prisma.expense.delete({ where: { id } }),
  ]);

  void notifyGroupMembers(user.id, expense.group.members.map((m) => m.memberId), {
    title: `Expense deleted in ${expense.group.name}`,
    body: `"${expense.description}" — ${amountStr} ${expense.group.currency} was removed`,
    url: `/groups/${expense.groupId}`,
  });

  revalidateExpensePaths(expense.groupId);
}

function revalidateExpensePaths(groupId: string) {
  revalidatePath("/expenses");
  revalidatePath("/settlements");
  revalidatePath("/analytics");
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/");
}
