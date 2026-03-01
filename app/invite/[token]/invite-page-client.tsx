"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptInvite, declineInvite } from "@/actions/group-invites";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { toast } from "sonner";
import { Users, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";

interface InviteData {
  id: string;
  email: string;
  status: string;
  expiresAt: Date;
  groupName: string;
  groupId: string;
  inviterName: string;
}

interface InvitePageClientProps {
  token: string;
  invite: InviteData | null;
  userEmail: string | null;
  isLoggedIn: boolean;
}

export function InvitePageClient({
  token,
  invite,
  userEmail,
  isLoggedIn,
}: InvitePageClientProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState(false);

  // Invalid or not found
  if (!invite) {
    return (
      <InviteLayout>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold">Invalid Invite</h2>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or has already been used.
          </p>
          <Button asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>
      </InviteLayout>
    );
  }

  // Expired
  if (invite.status === "EXPIRED" || new Date(invite.expiresAt) < new Date()) {
    return (
      <InviteLayout>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
            <Clock className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold">Invite Expired</h2>
          <p className="text-sm text-muted-foreground">
            This invite to <strong>{invite.groupName}</strong> has expired.
            Ask {invite.inviterName} to send a new one.
          </p>
          <Button asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>
      </InviteLayout>
    );
  }

  // Already accepted or declined
  if (invite.status !== "PENDING") {
    return (
      <InviteLayout>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CheckCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">
            Invite {invite.status === "ACCEPTED" ? "Accepted" : "Declined"}
          </h2>
          <p className="text-sm text-muted-foreground">
            This invite has already been {invite.status.toLowerCase()}.
          </p>
          <Button asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>
      </InviteLayout>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(`/invite/${token}`);
    return (
      <InviteLayout>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
            <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold">
            Join {invite.groupName}
          </h2>
          <p className="text-sm text-muted-foreground">
            <strong>{invite.inviterName}</strong> invited you to split expenses
            together on SplitEase.
          </p>
          <div className="flex flex-col gap-2 w-full pt-2">
            <Button asChild className="w-full">
              <Link href={`/login?callbackUrl=${callbackUrl}`}>
                Sign in to accept
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/signup?callbackUrl=${callbackUrl}`}>
                Create account to accept
              </Link>
            </Button>
          </div>
        </div>
      </InviteLayout>
    );
  }

  // Logged in but email doesn't match
  if (userEmail?.toLowerCase() !== invite.email) {
    return (
      <InviteLayout>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold">Email Mismatch</h2>
          <p className="text-sm text-muted-foreground">
            This invite was sent to a different email address. Please sign in
            with the correct account.
          </p>
          <p className="text-xs text-muted-foreground">
            Signed in as: {userEmail}
          </p>
          <Button asChild variant="outline">
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>
      </InviteLayout>
    );
  }

  // Success state after accepting/declining
  if (done) {
    return null; // Will have redirected already
  }

  async function handleAccept() {
    setAccepting(true);
    try {
      const result = await acceptInvite(token);
      if (result.error) {
        toast.error(result.error);
        setAccepting(false);
        return;
      }
      toast.success(`You've joined ${invite!.groupName}!`);
      setDone(true);
      router.push(`/groups/${result.groupId}`);
    } catch {
      toast.error("Failed to accept invite");
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    try {
      const result = await declineInvite(token);
      if (result.error) {
        toast.error(result.error);
        setDeclining(false);
        return;
      }
      toast.success("Invite declined");
      setDone(true);
      router.push("/");
    } catch {
      toast.error("Failed to decline invite");
      setDeclining(false);
    }
  }

  // Logged in, email matches, pending invite — show accept/decline
  return (
    <InviteLayout>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
          <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold">
          Join {invite.groupName}
        </h2>
        <p className="text-sm text-muted-foreground">
          <strong>{invite.inviterName}</strong> invited you to split expenses
          together on SplitEase.
        </p>
        <div className="flex gap-3 w-full pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDecline}
            disabled={accepting || declining}
          >
            {declining ? (
              <>
                <XCircle className="h-4 w-4 animate-spin" />
                Declining...
              </>
            ) : (
              "Decline"
            )}
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={accepting || declining}
          >
            {accepting ? (
              <>
                <CheckCircle className="h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept Invite"
            )}
          </Button>
        </div>
      </div>
    </InviteLayout>
  );
}

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex justify-center mb-6">
            <Logo size="md" />
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
