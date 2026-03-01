"use client";

import { useState, useCallback, useMemo } from "react";
import { removeGroupMember } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { InviteMembersDialog } from "@/components/groups/invite-members-dialog";
import { PendingInvites } from "@/components/groups/pending-invites";

interface Member {
  memberId: string;
  role: string;
  member: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

interface GroupMemberManagerProps {
  groupId: string;
  ownerId: string;
  members: Member[];
  currentUserId: string;
  onUpdate: () => void;
}

export function GroupMemberManager({
  groupId,
  ownerId,
  members,
  currentUserId,
  onUpdate,
}: GroupMemberManagerProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const nameA = a.member.fullName ?? "";
        const nameB = b.member.fullName ?? "";
        return nameA.localeCompare(nameB);
      }),
    [members]
  );

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await removeGroupMember(groupId, memberId);
      toast.success("Member removed");
      onUpdate();
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const handleInviteSent = useCallback(() => {
    setInviteRefreshKey((k) => k + 1);
  }, []);

  const getInitial = (name: string | null) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  return (
    <div className="space-y-6">
      {/* Current members */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Members ({members.length})
        </h4>
        <div className="space-y-2">
          {sortedMembers.map((m) => (
            <div
              key={m.memberId}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {getInitial(m.member.fullName)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {m.member.fullName ?? "Unknown"}
                  </span>
                  {m.role === "owner" && (
                    <Badge variant="secondary" className="text-xs">
                      Owner
                    </Badge>
                  )}
                </div>
              </div>
              {m.memberId !== ownerId && m.memberId !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(m.memberId)}
                  disabled={removingId === m.memberId}
                >
                  {removingId === m.memberId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserMinus className="size-4 text-red-500 dark:text-red-400" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending invites */}
      <PendingInvites groupId={groupId} refreshKey={inviteRefreshKey} />

      {/* Invite by email */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Invite Members
        </h4>
        <InviteMembersDialog
          groupId={groupId}
          onInviteSent={handleInviteSent}
          trigger={
            <Button variant="outline" className="w-full">
              Invite by Email
            </Button>
          }
        />
      </div>
    </div>
  );
}
