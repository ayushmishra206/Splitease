"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function exportUserData() {
  const user = await getAuthenticatedUser();

  const groups = await prisma.group.findMany({
    where: { ownerId: user.id },
    include: {
      members: true,
      expenses: { include: { splits: true } },
      settlements: true,
    },
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    groups,
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
