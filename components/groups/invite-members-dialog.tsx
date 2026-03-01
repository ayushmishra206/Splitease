"use client";

import { useState } from "react";
import { sendGroupInvite } from "@/actions/group-invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface InviteMembersDialogProps {
  groupId: string;
  onInviteSent?: () => void;
  trigger?: React.ReactNode;
}

export function InviteMembersDialog({
  groupId,
  onInviteSent,
  trigger,
}: InviteMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<
    { email: string; success: boolean; message: string }[]
  >([]);

  async function handleSend() {
    const emails = emailInput
      .split(/[,\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      toast.error("Please enter at least one email address");
      return;
    }

    setSending(true);
    const newResults: typeof results = [];

    for (const email of emails) {
      const result = await sendGroupInvite(groupId, email);
      if (result.error) {
        newResults.push({ email, success: false, message: result.error });
      } else {
        newResults.push({ email, success: true, message: "Invite sent" });
      }
    }

    setResults(newResults);
    setSending(false);

    const successCount = newResults.filter((r) => r.success).length;
    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Invite sent successfully"
          : `${successCount} invites sent successfully`
      );
      setEmailInput("");
      onInviteSent?.();
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setResults([]);
      setEmailInput("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Send email invites to add members to this group. They&apos;ll
            receive an email with a link to join.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Enter email addresses (comma-separated)"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !sending) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple emails with commas
            </p>
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !emailInput.trim()}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send Invite
              </>
            )}
          </Button>

          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Results
              </h4>
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                    r.success
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                  }`}
                >
                  <span className="font-medium truncate flex-1">
                    {r.email}
                  </span>
                  <span
                    className={`text-xs shrink-0 ${
                      r.success
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {r.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
