"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite, declineInvite } from "@/actions/group-invites";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Users, Check, X, Loader2, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Invite {
  id: string;
  email: string;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  group: { id: string; name: string };
  inviter: { fullName: string | null };
}

interface InvitesListClientProps {
  invites: Invite[];
}

export function InvitesListClient({ invites: initialInvites }: InvitesListClientProps) {
  const router = useRouter();
  const [invites, setInvites] = useState(initialInvites);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Note: We can't accept/decline directly here because tokens are hashed in DB.
  // The user needs to use the invite link from their email.
  // But we can show them the invites and link to the accept page.

  if (invites.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium mb-1">No pending invites</p>
          <p className="text-sm text-muted-foreground">
            When someone invites you to a group, it will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {invites.map((invite) => (
        <Card key={invite.id} className="py-4">
          <CardContent className="py-0">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{invite.group.name}</p>
                <p className="text-xs text-muted-foreground">
                  Invited by {invite.inviter.fullName ?? "Someone"}{" "}
                  {formatDistanceToNow(new Date(invite.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <p className="text-xs text-muted-foreground shrink-0">
                Check your email for the invite link
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
