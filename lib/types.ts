/** Client-safe shapes shared across components. */

export type MemberProfile = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type GroupMemberLite = {
  memberId: string;
  role: string;
  groupId?: string;
  joinedAt?: Date | string;
  member: MemberProfile;
};

/** Shape returned by `fetchGroups()` (dates may arrive as strings after JSON serialisation). */
export type GroupWithMembers = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  status?: string;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  owner: MemberProfile;
  members: GroupMemberLite[];
};

export function isArchived(group: Pick<GroupWithMembers, "status">): boolean {
  return group.status === "archived";
}
