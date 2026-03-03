"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { groupInviteEmail } from "@/lib/email/templates";
import { notifyGroupMembers } from "@/lib/push";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendGroupInvite(groupId: string, email: string) {
  const user = await getAuthenticatedUser();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: "Please enter a valid email address" };
  }

  // Verify user is a member of the group
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId, memberId: user.id } },
  });
  if (!membership) {
    return { error: "You are not a member of this group" };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, status: true },
  });
  if (!group) {
    return { error: "Group not found" };
  }
  if (group.status === "archived") {
    return { error: "Cannot invite members to an archived group" };
  }

  // Check if email is already a group member
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) {
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_memberId: { groupId, memberId: existingUser.id },
      },
    });
    if (existingMember) {
      return { error: "This person is already a member of the group" };
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.groupInvite.findUnique({
    where: { groupId_email: { groupId, email: normalizedEmail } },
  });
  if (existingInvite && existingInvite.status === "PENDING" && existingInvite.expiresAt > new Date()) {
    return { error: "An invite has already been sent to this email" };
  }

  // Rate limit: max 10 invites per group per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentInviteCount = await prisma.groupInvite.count({
    where: { groupId, createdAt: { gte: oneHourAgo } },
  });
  if (recentInviteCount >= 10) {
    return { error: "Too many invites sent recently. Please try again later." };
  }

  // Generate token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // If there's an old non-pending invite for this email+group, delete it first
  if (existingInvite) {
    await prisma.groupInvite.delete({ where: { id: existingInvite.id } });
  }

  await prisma.groupInvite.create({
    data: {
      groupId,
      email: normalizedEmail,
      token: hashedToken,
      invitedBy: user.id,
      expiresAt,
    },
  });

  // Get inviter name
  const inviter = await prisma.user.findUnique({
    where: { id: user.id },
    select: { fullName: true },
  });
  const inviterName = inviter?.fullName ?? "Someone";
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${rawToken}`;

  try {
    await sendEmail(
      normalizedEmail,
      `You're invited to join ${group.name} on SplitEase`,
      groupInviteEmail(inviterName, group.name, inviteUrl)
    );
  } catch {
    // Clean up the invite if email fails
    await prisma.groupInvite.deleteMany({
      where: { groupId, email: normalizedEmail, token: hashedToken },
    });
    return { error: "Failed to send invite email. Please try again." };
  }

  // If the invited email belongs to an existing user, send push notification
  if (existingUser) {
    void notifyGroupMembers(user.id, [existingUser.id], {
      title: "Group Invite",
      body: `${inviterName} invited you to join ${group.name}`,
      url: `/invite/${rawToken}`,
    });
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function acceptInvite(rawToken: string) {
  const user = await getAuthenticatedUser();
  const hashedToken = hashToken(rawToken);

  const invite = await prisma.groupInvite.findUnique({
    where: { token: hashedToken },
    include: {
      group: { select: { id: true, name: true } },
      inviter: { select: { id: true, fullName: true } },
    },
  });

  if (!invite) {
    return { error: "Invalid invite link" };
  }
  if (invite.status !== "PENDING") {
    return { error: "This invite has already been used" };
  }
  if (invite.expiresAt < new Date()) {
    return { error: "This invite has expired" };
  }

  // Email must match
  if (user.email?.toLowerCase() !== invite.email) {
    return { error: "This invite was sent to a different email address" };
  }

  // Transaction: accept invite + add to group
  await prisma.$transaction([
    prisma.groupInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    }),
    prisma.groupMember.create({
      data: {
        groupId: invite.groupId,
        memberId: user.id,
        role: "member",
      },
    }),
  ]);

  // Notify the inviter
  void notifyGroupMembers("__none__", [invite.inviter.id], {
    title: "Invite Accepted",
    body: `${user.name ?? "Someone"} accepted your invite to ${invite.group.name}`,
    url: `/groups/${invite.groupId}`,
  });

  revalidatePath(`/groups/${invite.groupId}`);
  revalidatePath("/groups");
  return { success: true, groupId: invite.groupId };
}

export async function declineInvite(rawToken: string) {
  const user = await getAuthenticatedUser();
  const hashedToken = hashToken(rawToken);

  const invite = await prisma.groupInvite.findUnique({
    where: { token: hashedToken },
  });

  if (!invite) {
    return { error: "Invalid invite link" };
  }
  if (invite.status !== "PENDING") {
    return { error: "This invite has already been used" };
  }

  // Email must match
  if (user.email?.toLowerCase() !== invite.email) {
    return { error: "This invite was sent to a different email address" };
  }

  await prisma.groupInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED" },
  });

  return { success: true };
}

export async function cancelInvite(inviteId: string) {
  const user = await getAuthenticatedUser();

  const invite = await prisma.groupInvite.findUnique({
    where: { id: inviteId },
    include: {
      group: { select: { ownerId: true } },
    },
  });

  if (!invite) {
    return { error: "Invite not found" };
  }

  // Only the inviter or group owner can cancel
  if (invite.invitedBy !== user.id && invite.group.ownerId !== user.id) {
    return { error: "Not authorized to cancel this invite" };
  }

  await prisma.groupInvite.delete({ where: { id: inviteId } });

  revalidatePath(`/groups/${invite.groupId}`);
  return { success: true };
}

export async function fetchGroupInvites(groupId: string) {
  const user = await getAuthenticatedUser();

  // Verify membership
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId, memberId: user.id } },
  });
  if (!membership) {
    return [];
  }

  return prisma.groupInvite.findMany({
    where: { groupId, status: "PENDING" },
    include: {
      inviter: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function fetchInviteByToken(rawToken: string) {
  const hashedToken = hashToken(rawToken);

  const invite = await prisma.groupInvite.findUnique({
    where: { token: hashedToken },
    include: {
      group: { select: { id: true, name: true } },
      inviter: { select: { fullName: true } },
    },
  });

  if (!invite) return null;

  return {
    id: invite.id,
    email: invite.email,
    status: invite.status,
    expiresAt: invite.expiresAt,
    groupName: invite.group.name,
    groupId: invite.group.id,
    inviterName: invite.inviter.fullName ?? "Someone",
  };
}

export async function fetchPendingInvitesForUser() {
  const user = await getAuthenticatedUser();
  if (!user.email) return [];

  return prisma.groupInvite.findMany({
    where: {
      email: user.email.toLowerCase(),
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: {
      group: { select: { id: true, name: true } },
      inviter: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function fetchPendingInviteCount() {
  const user = await getAuthenticatedUser();
  if (!user.email) return 0;

  return prisma.groupInvite.count({
    where: {
      email: user.email.toLowerCase(),
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
}
