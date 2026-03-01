"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmailSafe } from "@/lib/email/send";
import { settlementRecordedEmail } from "@/lib/email/templates";
import { notifyGroupMembers } from "@/lib/push";

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
    include: {
      group: { select: { id: true, name: true, currency: true } },
      from: { select: { id: true, fullName: true, avatarUrl: true } },
      to: { select: { id: true, fullName: true, avatarUrl: true } },
    },
    orderBy: { settlementDate: "desc" },
  });

  return settlements.map((s) => ({
    ...s,
    amount: parseFloat(String(s.amount)),
  }));
}

export async function createSettlement(input: {
  groupId: string;
  fromMember: string;
  toMember: string;
  amount: number;
  settlementDate: string;
  notes?: string;
}) {
  const user = await getAuthenticatedUser();

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: input.groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  const settlement = await prisma.settlement.create({
    data: {
      groupId: input.groupId,
      fromMember: input.fromMember,
      toMember: input.toMember,
      amount: input.amount,
      settlementDate: new Date(input.settlementDate),
      notes: input.notes,
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      from: { select: { id: true, fullName: true, avatarUrl: true } },
      to: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });

  // Notify both parties
  const amountStr = parseFloat(String(settlement.amount)).toFixed(2);
  const fromName = settlement.from.fullName ?? "Someone";
  const toName = settlement.to.fullName ?? "Someone";
  const groupName = settlement.group.name;
  const currency = settlement.group.currency;

  // Fetch emails for both parties
  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.fromMember }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: input.toMember }, select: { email: true } }),
  ]);

  if (fromUser?.email) {
    sendEmailSafe(
      fromUser.email,
      `Settlement in ${groupName}`,
      settlementRecordedEmail(fromName, amountStr, currency, groupName, fromName, toName)
    );
  }
  if (toUser?.email) {
    sendEmailSafe(
      toUser.email,
      `Settlement in ${groupName}`,
      settlementRecordedEmail(toName, amountStr, currency, groupName, fromName, toName)
    );
  }

  // Send push notifications
  void notifyGroupMembers(user.id, [input.fromMember, input.toMember], {
    title: `Settlement in ${groupName}`,
    body: `${fromName} paid ${toName} ${amountStr} ${currency}`,
    url: `/groups/${input.groupId}`,
  });

  // Log activity
  void prisma.activityLog.create({
    data: {
      groupId: input.groupId,
      userId: user.id,
      action: "created",
      entityType: "settlement",
      description: `${fromName} settled ${amountStr} ${currency} with ${toName}`,
    },
  });

  revalidatePath("/settlements");
  revalidatePath(`/groups/${input.groupId}`);
  revalidatePath("/");
  return { ...settlement, amount: parseFloat(String(settlement.amount)) };
}

export async function updateSettlement(input: {
  id: string;
  groupId: string;
  fromMember: string;
  toMember: string;
  amount: number;
  settlementDate: string;
  notes?: string;
}) {
  const user = await getAuthenticatedUser();

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: input.groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  const settlement = await prisma.settlement.update({
    where: { id: input.id },
    data: {
      fromMember: input.fromMember,
      toMember: input.toMember,
      amount: input.amount,
      settlementDate: new Date(input.settlementDate),
      notes: input.notes,
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      from: { select: { id: true, fullName: true, avatarUrl: true } },
      to: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });

  // Notify both parties about the update
  const fromName = settlement.from.fullName ?? "Someone";
  const toName = settlement.to.fullName ?? "Someone";
  const amountStr = parseFloat(String(settlement.amount)).toFixed(2);
  void notifyGroupMembers(user.id, [input.fromMember, input.toMember], {
    title: `Settlement updated in ${settlement.group.name}`,
    body: `${fromName} → ${toName}: ${amountStr} ${settlement.group.currency} (updated)`,
    url: `/groups/${input.groupId}`,
  });

  revalidatePath("/settlements");
  revalidatePath(`/groups/${input.groupId}`);
  revalidatePath("/");
  return { ...settlement, amount: parseFloat(String(settlement.amount)) };
}

export async function deleteSettlement(id: string) {
  const user = await getAuthenticatedUser();

  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      group: { select: { name: true, currency: true, members: { select: { memberId: true } } } },
      from: { select: { fullName: true } },
      to: { select: { fullName: true } },
    },
  });
  if (!settlement) throw new Error("Settlement not found");

  const isMember = settlement.group.members.some((m) => m.memberId === user.id);
  if (!isMember) throw new Error("Not authorized");

  await prisma.settlement.delete({ where: { id } });

  // Notify both parties about the deletion
  const fromName = settlement.from.fullName ?? "Someone";
  const toName = settlement.to.fullName ?? "Someone";
  const amountStr = parseFloat(String(settlement.amount)).toFixed(2);
  void notifyGroupMembers(user.id, [settlement.fromMember, settlement.toMember], {
    title: `Settlement deleted in ${settlement.group.name}`,
    body: `${fromName} → ${toName}: ${amountStr} ${settlement.group.currency} was removed`,
    url: `/groups/${settlement.groupId}`,
  });

  revalidatePath("/settlements");
  revalidatePath(`/groups/${settlement.groupId}`);
  revalidatePath("/");
}
