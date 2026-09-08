"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmailSafe } from "@/lib/email/send";
import { settlementRecordedEmail } from "@/lib/email/templates";
import { notifyGroupMembers } from "@/lib/push";
import { toNumber } from "@/lib/money";
import { parseOrThrow, settlementInputSchema, uuid } from "@/lib/validation";

const settlementInclude = {
  group: { select: { id: true, name: true, currency: true } },
  from: { select: { id: true, fullName: true, avatarUrl: true } },
  to: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

function serializeSettlement<T extends { amount: unknown }>(s: T) {
  return { ...s, amount: toNumber(s.amount) };
}

export async function fetchSettlements(groupId?: string) {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const settlements = await prisma.settlement.findMany({
    where: {
      groupId: groupId && groupIds.includes(groupId) ? groupId : { in: groupIds },
    },
    include: settlementInclude,
    orderBy: [{ settlementDate: "desc" }, { createdAt: "desc" }],
  });

  return settlements.map(serializeSettlement);
}

export type SettlementWithDetails = Awaited<ReturnType<typeof fetchSettlements>>[number];

/** Ensure the group is active, the caller is a member, and both parties are members. */
async function assertSettlementAllowed(groupId: string, userId: string, parties: string[]) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, currency: true, status: true, members: { select: { memberId: true } } },
  });
  if (!group) throw new Error("Group not found");
  const memberIds = new Set(group.members.map((m) => m.memberId));
  if (!memberIds.has(userId)) throw new Error("Not a member of this group");
  if (group.status === "archived") throw new Error("This group is archived");
  for (const id of parties) {
    if (!memberIds.has(id)) throw new Error("Both people must be members of the group");
  }
  return group;
}

export async function createSettlement(rawInput: unknown) {
  const user = await getAuthenticatedUser();
  const input = parseOrThrow(settlementInputSchema, rawInput);

  const group = await assertSettlementAllowed(input.groupId, user.id, [input.fromMember, input.toMember]);

  const settlement = await prisma.settlement.create({
    data: {
      groupId: input.groupId,
      fromMember: input.fromMember,
      toMember: input.toMember,
      amount: input.amount,
      settlementDate: new Date(input.settlementDate),
      notes: input.notes,
    },
    include: settlementInclude,
  });

  const amountStr = input.amount.toFixed(2);
  const fromName = settlement.from.fullName ?? "Someone";
  const toName = settlement.to.fullName ?? "Someone";

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.fromMember }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: input.toMember }, select: { email: true } }),
  ]);

  if (fromUser?.email) {
    sendEmailSafe(
      fromUser.email,
      `Settlement in ${group.name}`,
      settlementRecordedEmail(fromName, amountStr, group.currency, group.name, fromName, toName)
    );
  }
  if (toUser?.email) {
    sendEmailSafe(
      toUser.email,
      `Settlement in ${group.name}`,
      settlementRecordedEmail(toName, amountStr, group.currency, group.name, fromName, toName)
    );
  }

  void notifyGroupMembers(user.id, [input.fromMember, input.toMember], {
    title: `Settlement in ${group.name}`,
    body: `${fromName} paid ${toName} ${amountStr} ${group.currency}`,
    url: `/groups/${input.groupId}`,
  });

  await prisma.activityLog.create({
    data: {
      groupId: input.groupId,
      userId: user.id,
      action: "created",
      entityType: "settlement",
      description: `${fromName} settled ${amountStr} ${group.currency} with ${toName}`,
    },
  });

  revalidateSettlementPaths(input.groupId);
  return serializeSettlement(settlement);
}

export async function updateSettlement(rawInput: unknown) {
  const user = await getAuthenticatedUser();
  const id = parseOrThrow(uuid, (rawInput as { id?: unknown })?.id);
  const input = parseOrThrow(settlementInputSchema, rawInput);

  const existing = await prisma.settlement.findUnique({
    where: { id },
    select: { groupId: true },
  });
  if (!existing) throw new Error("Settlement not found");
  if (existing.groupId !== input.groupId) {
    throw new Error("A settlement cannot be moved to another group");
  }

  const group = await assertSettlementAllowed(existing.groupId, user.id, [input.fromMember, input.toMember]);

  const settlement = await prisma.settlement.update({
    where: { id },
    data: {
      fromMember: input.fromMember,
      toMember: input.toMember,
      amount: input.amount,
      settlementDate: new Date(input.settlementDate),
      notes: input.notes ?? null,
    },
    include: settlementInclude,
  });

  const fromName = settlement.from.fullName ?? "Someone";
  const toName = settlement.to.fullName ?? "Someone";
  const amountStr = input.amount.toFixed(2);
  void notifyGroupMembers(user.id, [input.fromMember, input.toMember], {
    title: `Settlement updated in ${group.name}`,
    body: `${fromName} → ${toName}: ${amountStr} ${group.currency} (updated)`,
    url: `/groups/${existing.groupId}`,
  });

  await prisma.activityLog.create({
    data: {
      groupId: existing.groupId,
      userId: user.id,
      action: "updated",
      entityType: "settlement",
      description: `Updated settlement: ${fromName} paid ${toName} ${amountStr} ${group.currency}`,
    },
  });

  revalidateSettlementPaths(existing.groupId);
  return serializeSettlement(settlement);
}

export async function deleteSettlement(rawId: unknown) {
  const user = await getAuthenticatedUser();
  const id = parseOrThrow(uuid, rawId);

  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      group: { select: { name: true, currency: true, status: true, members: { select: { memberId: true } } } },
      from: { select: { fullName: true } },
      to: { select: { fullName: true } },
    },
  });
  if (!settlement) throw new Error("Settlement not found");

  const isMember = settlement.group.members.some((m) => m.memberId === user.id);
  if (!isMember) throw new Error("Not authorized");
  if (settlement.group.status === "archived") throw new Error("This group is archived");

  const fromName = settlement.from.fullName ?? "Someone";
  const toName = settlement.to.fullName ?? "Someone";
  const amountStr = toNumber(settlement.amount).toFixed(2);

  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        groupId: settlement.groupId,
        userId: user.id,
        action: "deleted",
        entityType: "settlement",
        description: `Deleted settlement: ${fromName} paid ${toName} ${amountStr} ${settlement.group.currency}`,
      },
    }),
    prisma.settlement.delete({ where: { id } }),
  ]);

  void notifyGroupMembers(user.id, [settlement.fromMember, settlement.toMember], {
    title: `Settlement deleted in ${settlement.group.name}`,
    body: `${fromName} → ${toName}: ${amountStr} ${settlement.group.currency} was removed`,
    url: `/groups/${settlement.groupId}`,
  });

  revalidateSettlementPaths(settlement.groupId);
}

function revalidateSettlementPaths(groupId: string) {
  revalidatePath("/settlements");
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/");
}
