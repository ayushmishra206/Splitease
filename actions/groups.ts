"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { addedToGroupEmail } from "@/lib/email/templates";

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

  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      currency: input.currency ?? "USD",
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
        void sendEmail(
          memberEmail.email,
          `You've been added to ${group.name}`,
          addedToGroupEmail(gm.member.fullName ?? "there", group.name, creatorName)
        );
      }
    }
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

  const updated = await prisma.group.update({
    where: { id },
    data: input,
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
  if (member.member.email) {
    const adderName = (await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true },
    }))?.fullName ?? "Someone";

    void sendEmail(
      member.member.email,
      `You've been added to ${group.name}`,
      addedToGroupEmail(member.member.fullName ?? "there", group.name, adderName)
    );
  }

  revalidatePath("/groups");
  return member;
}

export async function removeGroupMember(groupId: string, memberId: string) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findFirst({
    where: { id: groupId, ownerId: user.id },
  });
  if (!group) throw new Error("Not authorized to manage this group");

  await prisma.groupMember.delete({
    where: { groupId_memberId: { groupId, memberId } },
  });

  revalidatePath("/groups");
}

export async function searchProfiles(term: string) {
  if (term.length < 2) return [];

  return prisma.user.findMany({
    where: {
      fullName: { contains: term, mode: "insensitive" },
    },
    select: { id: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
    take: 10,
  });
}
