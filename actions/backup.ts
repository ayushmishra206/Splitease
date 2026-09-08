"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { toNumber } from "@/lib/money";
import { normalizePayers } from "@/lib/expenses-shared";

/**
 * Backup format (version 2). It is both human-readable (names alongside ids)
 * and restorable: ids are stable UUIDs so re-importing is idempotent.
 */
const BACKUP_VERSION = 2;

const memberRef = z.object({ memberId: z.string().uuid(), name: z.string().optional() });

const backupSchema = z.object({
  version: z.literal(2),
  exportedAt: z.string().optional(),
  user: z.object({ id: z.string().uuid(), name: z.string(), email: z.string() }).optional(),
  groups: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(80),
      description: z.string().nullable().optional(),
      currency: z.string().length(3),
      status: z.string().optional(),
      ownerId: z.string().uuid(),
      members: z.array(memberRef.extend({ role: z.string().optional(), email: z.string().optional() })),
      expenses: z.array(
        z.object({
          id: z.string().uuid(),
          description: z.string().min(1).max(120),
          amount: z.union([z.number(), z.string()]),
          category: z.string().nullable().optional(),
          splitType: z.string().optional(),
          expenseDate: z.string(),
          notes: z.string().nullable().optional(),
          receiptUrl: z.string().nullable().optional(),
          payerId: z.string().uuid().nullable().optional(),
          createdById: z.string().uuid().nullable().optional(),
          payers: z.array(memberRef.extend({ amount: z.union([z.number(), z.string()]) })).optional(),
          splits: z.array(memberRef.extend({ share: z.union([z.number(), z.string()]) })),
        })
      ),
      settlements: z.array(
        z.object({
          id: z.string().uuid(),
          fromMember: z.string().uuid(),
          fromName: z.string().optional(),
          toMember: z.string().uuid(),
          toName: z.string().optional(),
          amount: z.union([z.number(), z.string()]),
          settlementDate: z.string(),
          notes: z.string().nullable().optional(),
        })
      ),
    })
  ),
});

export type BackupPayload = z.infer<typeof backupSchema>;

/** Legacy (version 1) shape produced by the very first release. */
const legacyBackupSchema = z.object({
  version: z.literal(1),
  groups: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string().nullable().optional(),
      currency: z.string(),
      ownerId: z.string().uuid(),
      members: z.array(z.object({ groupId: z.string(), memberId: z.string().uuid(), role: z.string() })),
      expenses: z.array(
        z.object({
          id: z.string().uuid(),
          groupId: z.string(),
          payerId: z.string().uuid(),
          description: z.string(),
          amount: z.union([z.number(), z.string()]),
          expenseDate: z.string(),
          notes: z.string().nullable().optional(),
          splits: z.array(
            z.object({ id: z.string(), expenseId: z.string(), memberId: z.string().uuid(), share: z.union([z.number(), z.string()]) })
          ),
        })
      ),
      settlements: z.array(
        z.object({
          id: z.string().uuid(),
          groupId: z.string(),
          fromMember: z.string().uuid(),
          toMember: z.string().uuid(),
          amount: z.union([z.number(), z.string()]),
          settlementDate: z.string(),
          notes: z.string().nullable().optional(),
        })
      ),
    })
  ),
});

function legacyToCurrent(legacy: z.infer<typeof legacyBackupSchema>): BackupPayload {
  return {
    version: 2,
    groups: legacy.groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description ?? null,
      currency: g.currency,
      ownerId: g.ownerId,
      members: g.members.map((m) => ({ memberId: m.memberId, role: m.role })),
      expenses: g.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        expenseDate: e.expenseDate,
        notes: e.notes ?? null,
        payerId: e.payerId,
        splits: e.splits.map((s) => ({ memberId: s.memberId, share: s.share })),
      })),
      settlements: g.settlements.map((s) => ({
        id: s.id,
        fromMember: s.fromMember,
        toMember: s.toMember,
        amount: s.amount,
        settlementDate: s.settlementDate,
        notes: s.notes ?? null,
      })),
    })),
  };
}

export async function exportUserData(): Promise<BackupPayload> {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const [groups, dbUser] = await Promise.all([
    prisma.group.findMany({
      where: { id: { in: groupIds } },
      include: {
        members: { include: { member: { select: { id: true, fullName: true, email: true } } } },
        expenses: {
          include: {
            payer: { select: { id: true, fullName: true } },
            payers: { include: { member: { select: { id: true, fullName: true } } } },
            splits: { include: { member: { select: { id: true, fullName: true } } } },
          },
          orderBy: { expenseDate: "desc" },
        },
        settlements: {
          include: {
            from: { select: { id: true, fullName: true } },
            to: { select: { id: true, fullName: true } },
          },
          orderBy: { settlementDate: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true, email: true },
    }),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: { id: user.id, name: dbUser.fullName ?? "Unknown", email: dbUser.email },
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      currency: g.currency,
      status: g.status,
      ownerId: g.ownerId,
      members: g.members.map((m) => ({
        memberId: m.member.id,
        name: m.member.fullName ?? m.member.email,
        email: m.member.email,
        role: m.role,
      })),
      expenses: g.expenses.map((e) => {
        const amount = toNumber(e.amount);
        const payers =
          e.payers.length > 0
            ? e.payers.map((p) => ({ memberId: p.member.id, name: p.member.fullName ?? "Unknown", amount: toNumber(p.amount) }))
            : e.payer
              ? [{ memberId: e.payer.id, name: e.payer.fullName ?? "Unknown", amount }]
              : [];
        return {
          id: e.id,
          description: e.description,
          amount,
          category: e.category,
          splitType: e.splitType,
          expenseDate: e.expenseDate.toISOString().split("T")[0],
          notes: e.notes,
          receiptUrl: e.receiptUrl,
          payerId: e.payerId,
          createdById: e.createdById,
          payers,
          splits: e.splits.map((s) => ({
            memberId: s.member.id,
            name: s.member.fullName ?? "Unknown",
            share: toNumber(s.share),
          })),
        };
      }),
      settlements: g.settlements.map((s) => ({
        id: s.id,
        fromMember: s.from.id,
        fromName: s.from.fullName ?? "Unknown",
        toMember: s.to.id,
        toName: s.to.fullName ?? "Unknown",
        amount: toNumber(s.amount),
        settlementDate: s.settlementDate.toISOString().split("T")[0],
        notes: s.notes,
      })),
    })),
  };
}

export async function importUserData(rawPayload: unknown) {
  const user = await getAuthenticatedUser();

  let payload: BackupPayload;
  const current = backupSchema.safeParse(rawPayload);
  if (current.success) {
    payload = current.data;
  } else {
    const legacy = legacyBackupSchema.safeParse(rawPayload);
    if (!legacy.success) {
      throw new Error("Unsupported or malformed backup file");
    }
    payload = legacyToCurrent(legacy.data);
  }

  const results = {
    imported: 0,
    skipped: [] as Array<{ name: string; reason: string }>,
    errors: [] as string[],
  };

  // Only ids that map to real accounts can be restored as members/payers/participants
  const referencedIds = new Set<string>();
  for (const g of payload.groups) {
    for (const m of g.members) referencedIds.add(m.memberId);
    for (const e of g.expenses) {
      if (e.payerId) referencedIds.add(e.payerId);
      for (const p of e.payers ?? []) referencedIds.add(p.memberId);
      for (const s of e.splits) referencedIds.add(s.memberId);
    }
    for (const s of g.settlements) {
      referencedIds.add(s.fromMember);
      referencedIds.add(s.toMember);
    }
  }
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: [...referencedIds] } },
    select: { id: true },
  });
  const knownIds = new Set(existingUsers.map((u) => u.id));

  for (const group of payload.groups) {
    if (group.ownerId !== user.id) {
      results.skipped.push({ name: group.name, reason: "Not owned by you" });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.group.upsert({
          where: { id: group.id },
          update: {
            name: group.name,
            description: group.description ?? null,
            currency: group.currency,
            ...(group.status ? { status: group.status } : {}),
          },
          create: {
            id: group.id,
            name: group.name,
            description: group.description ?? null,
            currency: group.currency,
            status: group.status ?? "active",
            ownerId: user.id,
          },
        });

        const memberIds = new Set<string>([user.id]);
        for (const m of group.members) if (knownIds.has(m.memberId)) memberIds.add(m.memberId);
        for (const memberId of memberIds) {
          await tx.groupMember.upsert({
            where: { groupId_memberId: { groupId: group.id, memberId } },
            update: {},
            create: {
              groupId: group.id,
              memberId,
              role: memberId === user.id ? "owner" : (group.members.find((m) => m.memberId === memberId)?.role ?? "member"),
            },
          });
        }

        for (const expense of group.expenses) {
          const amount = toNumber(expense.amount);
          const splits = expense.splits
            .filter((s) => memberIds.has(s.memberId))
            .map((s) => ({ memberId: s.memberId, share: toNumber(s.share) }));
          if (splits.length === 0) continue;

          const fallbackPayer =
            expense.payerId && memberIds.has(expense.payerId) ? expense.payerId : user.id;
          const { payers, primaryPayerId } = normalizePayers(
            (expense.payers ?? []).filter((p) => memberIds.has(p.memberId)).map((p) => ({ memberId: p.memberId, amount: toNumber(p.amount) })),
            fallbackPayer,
            amount
          );

          const data = {
            description: expense.description,
            amount,
            category: expense.category ?? null,
            splitType: expense.splitType ?? "equal",
            expenseDate: new Date(expense.expenseDate),
            notes: expense.notes ?? null,
            receiptUrl: expense.receiptUrl ?? null,
            payerId: primaryPayerId,
          };

          await tx.expense.upsert({
            where: { id: expense.id },
            update: data,
            create: {
              id: expense.id,
              groupId: group.id,
              createdById:
                expense.createdById && knownIds.has(expense.createdById) ? expense.createdById : user.id,
              ...data,
            },
          });
          await tx.expenseSplit.deleteMany({ where: { expenseId: expense.id } });
          await tx.expensePayer.deleteMany({ where: { expenseId: expense.id } });
          await tx.expenseSplit.createMany({
            data: splits.map((s) => ({ expenseId: expense.id, ...s })),
          });
          await tx.expensePayer.createMany({
            data: payers.map((p) => ({ expenseId: expense.id, ...p })),
          });
        }

        for (const settlement of group.settlements) {
          if (!memberIds.has(settlement.fromMember) || !memberIds.has(settlement.toMember)) continue;
          const data = {
            fromMember: settlement.fromMember,
            toMember: settlement.toMember,
            amount: toNumber(settlement.amount),
            settlementDate: new Date(settlement.settlementDate),
            notes: settlement.notes ?? null,
          };
          await tx.settlement.upsert({
            where: { id: settlement.id },
            update: data,
            create: { id: settlement.id, groupId: group.id, ...data },
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

  revalidatePath("/");
  revalidatePath("/groups");
  revalidatePath("/expenses");
  revalidatePath("/settlements");
  return results;
}
