"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchGroupInvites, cancelInvite } from "@/actions/group-invites";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Clock, Mail } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface PendingInvitesProps {
  groupId: string;
  refreshKey?: number;
}

interface Invite {
  id: string;
  email: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviter: { fullName: string | null };
}

export function PendingInvites({ groupId, refreshKey }: PendingInvitesProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    try {
      const data = await fetchGroupInvites(groupId);
      setInvites(data as Invite[]);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites, refreshKey]);

  async function handleCancel(inviteId: string) {
    setCancellingId(inviteId);
    try {
      const result = await cancelInvite(inviteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invite cancelled");
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } catch {
      toast.error("Failed to cancel invite");
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invites.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Pending Invites ({invites.length})
      </h4>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between rounded-lg border border-dashed p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30 text-sm">
                <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  Invited{" "}
                  {formatDistanceToNow(new Date(invite.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs">
                Pending
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCancel(invite.id)}
                disabled={cancellingId === invite.id}
              >
                {cancellingId === invite.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4 text-red-500 dark:text-red-400" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
