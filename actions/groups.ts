"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmailSafe } from "@/lib/email/send";
import { addedToGroupEmail } from "@/lib/email/templates";
import { notifyGroupMembers } from "@/lib/push";
import { roundMoney, toNumber } from "@/lib/money";
import { computeNetBalances } from "@/lib/simplify-debts";

const CURRENCY_CODE = /^[A-Z]{3}$/;

function validateGroupInput(input: { name?: string; description?: string; currency?: string }) {
  const name = input.name?.trim();
  if (input.name !== undefined && (!name || name.length > 80)) {
    throw new Error("Group name must be between 1 and 80 characters");
  }
  if (input.description !== undefined && input.description.length > 240) {
    throw new Error("Description must be 240 characters or less");
  }
  if (input.currency !== undefined && !CURRENCY_CODE.test(input.currency)) {
    throw new Error("Currency must be a 3-letter code");
  }
  return { ...input, name };
}

/** Total spent and expense count per group, for list views. */
export async function fetchGroupTotals(groupIds: string[]) {
  if (groupIds.length === 0) return {} as Record<string, { totalSpent: number; expenseCount: number }>;
  const rows = await prisma.expense.groupBy({
    by: ["groupId"],
    where: { groupId: { in: groupIds } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totals: Record<string, { totalSpent: number; expenseCount: number }> = {};
  for (const r of rows) {
    totals[r.groupId] = {
      totalSpent: roundMoney(toNumber(r._sum.amount)),
      expenseCount: r._count._all,
    };
  }
  return totals;
}

/** Net balance of one member inside a group (positive = owed money). */
async function memberNetBalance(groupId: string, memberId: string): Promise<number> {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId },
      select: {
        payerId: true,
        amount: true,
        payers: { select: { memberId: true, amount: true } },
        splits: { select: { memberId: true, share: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      select: { fromMember: true, toMember: true, amount: true },
    }),
  ]);
  const net = computeNetBalances(
    expenses.map((e) => ({
      payerId: e.payerId,
      amount: toNumber(e.amount),
      payers: e.payers.map((p) => ({ memberId: p.memberId, amount: toNumber(p.amount) })),
      splits: e.splits.map((s) => ({ memberId: s.memberId, share: toNumber(s.share) })),
    })),
    settlements.map((s) => ({ fromMember: s.fromMember, toMember: s.toMember, amount: toNumber(s.amount) }))
  );
  return roundMoney(net[memberId] ?? 0);
}

export async function fetchGroups() {
  const user = await getAuthenticatedUser();

  return prisma.group.findMany({
    where: {
      members: { some: { memberId: user.id } },
    },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      members: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createGroup(input: {
  name: string;
  description?: string;
  currency?: string;
  memberIds?: string[];
}) {
  const user = await getAuthenticatedUser();
  const valid = validateGroupInput(input);

  const group = await prisma.group.create({
    data: {
      name: valid.name!,
      description: valid.description || null,
      currency: valid.currency ?? "USD",
      ownerId: user.id,
      members: {
        create: [
          { memberId: user.id, role: "owner" },
          ...(input.memberIds ?? [])
            .filter((id) => id !== user.id)
            .map((id) => ({ memberId: id, role: "member" as const })),
        ],
      },
    },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      members: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  });

  // Notify added members (not the creator)
  const addedMembers = group.members.filter((m) => m.member.id !== user.id);
  if (addedMembers.length > 0) {
    const creatorName = group.owner.fullName ?? "Someone";
    for (const gm of addedMembers) {
      const memberEmail = await prisma.user.findUnique({
        where: { id: gm.member.id },
        select: { email: true },
      });
      if (memberEmail?.email) {
        sendEmailSafe(
          memberEmail.email,
          `You've been added to ${group.name}`,
          addedToGroupEmail(gm.member.fullName ?? "there", group.name, creatorName)
        );
      }
    }

    // Push notifications to added members
    void notifyGroupMembers(user.id, addedMembers.map((m) => m.member.id), {
      title: `Added to ${group.name}`,
      body: `${creatorName} added you to ${group.name}`,
      url: `/groups/${group.id}`,
    });
  }

  revalidatePath("/groups");
  revalidatePath("/");
  return group;
}

export async function updateGroup(
  id: string,
  input: { name?: string; description?: string; currency?: string }
) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!group) throw new Error("Group not found or not authorized");

  const valid = validateGroupInput(input);
  const updated = await prisma.group.update({
    where: { id },
    data: {
      ...(valid.name !== undefined ? { name: valid.name } : {}),
      ...(valid.description !== undefined ? { description: valid.description || null } : {}),
      ...(valid.currency !== undefined ? { currency: valid.currency } : {}),
    },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      members: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  });

  revalidatePath("/groups");
  revalidatePath("/");
  return updated;
}

export async function deleteGroup(id: string) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!group) throw new Error("Group not found or not authorized");

  await prisma.group.delete({ where: { id } });
  revalidatePath("/groups");
  revalidatePath("/");
}

export async function addGroupMember(groupId: string, memberId: string) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findFirst({
    where: { id: groupId, ownerId: user.id },
  });
  if (!group) throw new Error("Not authorized to manage this group");

  const member = await prisma.groupMember.create({
    data: { groupId, memberId, role: "member" },
    include: {
      member: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
    },
  });

  // Notify the added member
  const adderName = (await prisma.user.findUnique({
    where: { id: user.id },
    select: { fullName: true },
  }))?.fullName ?? "Someone";

  if (member.member.email) {
    sendEmailSafe(
      member.member.email,
      `You've been added to ${group.name}`,
      addedToGroupEmail(member.member.fullName ?? "there", group.name, adderName)
    );
  }

  // Push notification to the new member
  void notifyGroupMembers(user.id, [memberId], {
    title: `Added to ${group.name}`,
    body: `${adderName} added you to ${group.name}`,
    url: `/groups/${groupId}`,
  });

  revalidatePath("/groups");
  return member;
}

export async function removeGroupMember(groupId: string, memberId: string) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findFirst({
    where: { id: groupId, ownerId: user.id },
  });
  if (!group) throw new Error("Not authorized to manage this group");
  if (memberId === group.ownerId) throw new Error("The group owner cannot be removed");

  const balance = await memberNetBalance(groupId, memberId);
  if (Math.abs(balance) > 0.01) {
    throw new Error("This member still has an outstanding balance. Settle up before removing them.");
  }

  await prisma.groupMember.delete({
    where: { groupId_memberId: { groupId, memberId } },
  });

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/");
}

/** Leave a group you are a member of (not the owner) once your balance is settled. */
export async function leaveGroup(groupId: string) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { ownerId: true, members: { select: { memberId: true } } },
  });
  if (!group || !group.members.some((m) => m.memberId === user.id)) {
    throw new Error("Not a member of this group");
  }
  if (group.ownerId === user.id) {
    throw new Error("Owners cannot leave their own group. Archive or delete it instead.");
  }

  const balance = await memberNetBalance(groupId, user.id);
  if (Math.abs(balance) > 0.01) {
    throw new Error("Settle your balance before leaving this group.");
  }

  await prisma.groupMember.delete({
    where: { groupId_memberId: { groupId, memberId: user.id } },
  });

  revalidatePath("/groups");
  revalidatePath("/");
}

export async function searchProfiles(term: string) {
  await getAuthenticatedUser();
  const q = term.trim();
  if (q.length < 2) return [];

  return prisma.user.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { equals: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
    take: 10,
  });
}

export async function archiveGroup(id: string) {
  const user = await getAuthenticatedUser();
  const group = await prisma.group.findFirst({ where: { id, ownerId: user.id } });
  if (!group) throw new Error("Group not found or not authorized");

  await prisma.group.update({ where: { id }, data: { status: "archived" } });
  revalidatePath("/groups");
  revalidatePath(`/groups/${id}`);
  revalidatePath("/");
}

export async function restoreGroup(id: string) {
  const user = await getAuthenticatedUser();
  const group = await prisma.group.findFirst({ where: { id, ownerId: user.id } });
  if (!group) throw new Error("Group not found or not authorized");

  await prisma.group.update({ where: { id }, data: { status: "active" } });
  revalidatePath("/groups");
  revalidatePath(`/groups/${id}`);
  revalidatePath("/");
}
