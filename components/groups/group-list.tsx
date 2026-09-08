"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGroup, updateGroup, deleteGroup, leaveGroup } from "@/actions/groups";
import { toast } from "sonner";
import {
  Archive,
  Crown,
  LogOut,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Users,
  UsersRound,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { GroupWithMembers } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { GroupForm } from "./group-form";
import { GroupMemberManager } from "./group-member-manager";

type GroupTotals = Record<string, { totalSpent: number; expenseCount: number }>;

interface GroupListProps {
  groups: GroupWithMembers[];
  totals: GroupTotals;
  currentUserId: string;
}

export function GroupList({ groups, totals, currentUserId }: GroupListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupWithMembers | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupWithMembers | null>(
    null
  );
  const [membersGroup, setMembersGroup] = useState<GroupWithMembers | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<GroupWithMembers | null>(null);
  const [leaving, setLeaving] = useState(false);

  const activeGroups = groups.filter((g) => g.status !== "archived");
  const archivedGroups = groups.filter((g) => g.status === "archived");

  const handleCreate = async (data: {
    name: string;
    description?: string;
    currency: string;
  }) => {
    try {
      await createGroup(data);
      toast.success("Group created");
      setCreateOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create group");
    }
  };

  const handleUpdate = async (data: {
    name: string;
    description?: string;
    currency: string;
  }) => {
    if (!editGroup) return;
    try {
      await updateGroup(editGroup.id, data);
      toast.success("Group updated");
      setEditGroup(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update group");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteGroup(deleteTarget.id);
      toast.success("Group deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete group");
    } finally {
      setDeleting(false);
    }
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    try {
      await leaveGroup(leaveTarget.id);
      toast.success(`You left ${leaveTarget.name}`);
      setLeaveTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not leave group");
    } finally {
      setLeaving(false);
    }
  };

  const totalLabel = (group: GroupWithMembers) => {
    const t = totals[group.id];
    if (!t || t.expenseCount === 0) return "No expenses yet";
    return `${formatCurrency(t.totalSpent, group.currency)} · ${t.expenseCount} expense${t.expenseCount === 1 ? "" : "s"}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl">Groups</h1>
          <Badge variant="secondary">{activeGroups.length}</Badge>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="hidden md:inline-flex">
          <Plus className="size-4" />
          New Group
        </Button>
      </div>

      {/* Group grid */}
      {activeGroups.length === 0 && archivedGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center sm:p-16">
          <UsersRound className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No groups yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first group to start splitting expenses.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-6">
            <Plus className="size-4" />
            Create Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeGroups.map((group) => {
            const isOwner = group.ownerId === currentUserId;

            return (
              <Card key={group.id} className="gap-4 py-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <Link href={`/groups/${group.id}`} className="block">
                  <CardHeader className="pb-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base">
                          {group.name}
                        </CardTitle>
                        {group.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {group.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2 shrink-0">
                        {group.currency}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 pt-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        {group.members.length}{" "}
                        {group.members.length === 1 ? "member" : "members"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Receipt className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{totalLabel(group)}</span>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Crown className="size-3" />
                        You own this group
                      </div>
                    )}
                  </CardContent>
                </Link>

                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 pt-1">
                    {isOwner && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditGroup(group)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMembersGroup(group)}
                        >
                          <Users className="size-3.5" />
                          Members
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="ml-auto"
                          onClick={() => setDeleteTarget(group)}
                        >
                          <Trash2 className="size-3.5 text-red-500 dark:text-red-400" />
                        </Button>
                      </>
                    )}
                    {!isOwner && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMembersGroup(group)}
                        >
                          <Users className="size-3.5" />
                          Members
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-muted-foreground"
                          onClick={() => setLeaveTarget(group)}
                        >
                          <LogOut className="size-3.5" />
                          Leave
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {archivedGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Archived
          </h2>
          <div className="grid grid-cols-1 gap-3 opacity-70 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archivedGroups.map((group) => {
              return (
                <Card key={group.id} className="gap-4 py-5">
                  <Link href={`/groups/${group.id}`} className="block">
                    <CardHeader className="pb-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base">{group.name}</CardTitle>
                          {group.description && (
                            <CardDescription className="mt-1 line-clamp-2">{group.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-2 shrink-0">{group.currency}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          {group.members.length} {group.members.length === 1 ? "member" : "members"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Archive className="size-3.5" />
                          Archived
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Receipt className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{totalLabel(group)}</span>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <Button
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden"
        size="icon-lg"
        aria-label="Create group"
        onClick={() => setCreateOpen(true)}
      >
        <UsersRound className="size-6" />
      </Button>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Create a new group to start splitting expenses with friends.
            </DialogDescription>
          </DialogHeader>
          <GroupForm
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            submitLabel="Create Group"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editGroup} onOpenChange={() => setEditGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update your group details.
            </DialogDescription>
          </DialogHeader>
          {editGroup && (
            <GroupForm
              onSubmit={handleUpdate}
              onCancel={() => setEditGroup(null)}
              defaultValues={{
                name: editGroup.name,
                description: editGroup.description ?? "",
                currency: editGroup.currency,
              }}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will permanently remove the group and all its expenses and
              settlements. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave confirmation */}
      <AlertDialog open={!!leaveTarget} onOpenChange={(v) => !v && setLeaveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave &quot;{leaveTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              You will stop seeing this group&apos;s expenses. You can only leave once your balance is settled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleLeave} disabled={leaving}>
              {leaving ? "Leaving..." : "Leave group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members dialog */}
      <Dialog open={!!membersGroup} onOpenChange={() => setMembersGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {membersGroup?.ownerId === currentUserId ? "Manage members" : "Members"} · {membersGroup?.name}
            </DialogTitle>
            <DialogDescription>
              {membersGroup?.ownerId === currentUserId
                ? "Add or remove members. Members with a balance must settle up first."
                : "People in this group."}
            </DialogDescription>
          </DialogHeader>
          {membersGroup && (
            <GroupMemberManager
              groupId={membersGroup.id}
              ownerId={membersGroup.ownerId}
              members={membersGroup.members.map((m) => ({
                memberId: m.memberId,
                role: m.role,
                member: m.member,
              }))}
              currentUserId={currentUserId}
              onUpdate={() => {
                setMembersGroup(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
