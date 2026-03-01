"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function exportUserData() {
  const user = await getAuthenticatedUser();

  // Get all groups the user is a member of (not just owned)
  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: {
      members: { include: { member: { select: { fullName: true, email: true } } } },
      expenses: {
        include: {
          payer: { select: { fullName: true } },
          splits: { include: { member: { select: { fullName: true } } } },
        },
        orderBy: { expenseDate: "desc" },
      },
      settlements: {
        include: {
          from: { select: { fullName: true } },
          to: { select: { fullName: true } },
        },
        orderBy: { settlementDate: "desc" },
      },
    },
  });

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { fullName: true, email: true },
  });

  return {
    exportedAt: new Date().toISOString(),
    user: { name: dbUser.fullName ?? "Unknown", email: dbUser.email },
    groups: groups.map((g) => ({
      name: g.name,
      description: g.description,
      currency: g.currency,
      status: g.status,
      members: g.members.map((m) => m.member.fullName ?? m.member.email),
      expenses: g.expenses.map((e) => ({
        description: e.description,
        amount: parseFloat(String(e.amount)),
        paidBy: e.payer?.fullName ?? "Unknown",
        date: e.expenseDate.toISOString().split("T")[0],
        category: e.category,
        notes: e.notes,
        splitBetween: e.splits.map((s) => ({
          name: s.member.fullName ?? "Unknown",
          share: parseFloat(String(s.share)),
        })),
      })),
      settlements: g.settlements.map((s) => ({
        from: s.from.fullName ?? "Unknown",
        to: s.to.fullName ?? "Unknown",
        amount: parseFloat(String(s.amount)),
        date: s.settlementDate.toISOString().split("T")[0],
        notes: s.notes,
      })),
    })),
  };
}

export async function importUserData(payload: {
  version: number;
  groups: Array<{
    id: string;
    name: string;
    description?: string | null;
    currency: string;
    ownerId: string;
    members: Array<{ groupId: string; memberId: string; role: string }>;
    expenses: Array<{
      id: string;
      groupId: string;
      payerId: string;
      description: string;
      amount: number | string;
      expenseDate: string;
      notes?: string | null;
      splits: Array<{
        id: string;
        expenseId: string;
        memberId: string;
        share: number | string;
      }>;
    }>;
    settlements: Array<{
      id: string;
      groupId: string;
      fromMember: string;
      toMember: string;
      amount: number | string;
      settlementDate: string;
      notes?: string | null;
    }>;
  }>;
}) {
  const user = await getAuthenticatedUser();

  if (payload.version !== 1) throw new Error("Unsupported backup version");

  const results = {
    imported: 0,
    skipped: [] as Array<{ name: string; reason: string }>,
    errors: [] as string[],
  };

  for (const group of payload.groups) {
    if (group.ownerId !== user.id) {
      results.skipped.push({
        name: group.name,
        reason: "Not owned by you",
      });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.group.upsert({
          where: { id: group.id },
          update: {
            name: group.name,
            description: group.description,
            currency: group.currency,
          },
          create: {
            id: group.id,
            name: group.name,
            description: group.description,
            currency: group.currency,
            ownerId: user.id,
          },
        });

        for (const member of group.members) {
          await tx.groupMember.upsert({
            where: {
              groupId_memberId: {
                groupId: member.groupId,
                memberId: member.memberId,
              },
            },
            update: { role: member.role },
            create: member,
          });
        }

        for (const expense of group.expenses) {
          await tx.expense.upsert({
            where: { id: expense.id },
            update: {
              description: expense.description,
              amount: expense.amount,
              payerId: expense.payerId,
            },
            create: {
              id: expense.id,
              groupId: expense.groupId,
              payerId: expense.payerId,
              description: expense.description,
              amount: expense.amount,
              expenseDate: new Date(expense.expenseDate),
              notes: expense.notes,
            },
          });

          for (const split of expense.splits) {
            await tx.expenseSplit.upsert({
              where: { id: split.id },
              update: { share: split.share },
              create: {
                id: split.id,
                expenseId: split.expenseId,
                memberId: split.memberId,
                share: split.share,
              },
            });
          }
        }

        for (const settlement of group.settlements) {
          await tx.settlement.upsert({
            where: { id: settlement.id },
            update: { amount: settlement.amount, notes: settlement.notes },
            create: {
              id: settlement.id,
              groupId: settlement.groupId,
              fromMember: settlement.fromMember,
              toMember: settlement.toMember,
              amount: settlement.amount,
              settlementDate: new Date(settlement.settlementDate),
              notes: settlement.notes,
            },
          });
        }
      });
      results.imported++;
    } catch (e) {
      results.errors.push(
        `Failed to import "${group.name}": ${e instanceof Error ? e.message : "Unknown error"}`
      );
    }
  }

  return results;
}
