"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup, updateGroup, deleteGroup } from "@/actions/groups";
import { toast } from "sonner";
import {
  Calendar,
  Crown,
  Pencil,
  Plus,
  Trash2,
  Users,
  UsersRound,
} from "lucide-react";

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

type GroupWithMembers = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  members: Array<{
    memberId: string;
    role: string;
    groupId: string;
    joinedAt: Date;
    member: {
      id: string;
      fullName: string | null;
      avatarUrl: string | null;
    };
  }>;
};

interface GroupListProps {
  groups: GroupWithMembers[];
  currentUserId: string;
}

export function GroupList({ groups, currentUserId }: GroupListProps) {
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
    } catch {
      toast.error("Failed to create group");
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
    } catch {
      toast.error("Failed to update group");
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
    } catch {
      toast.error("Failed to delete group");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Groups</h1>
          <Badge variant="secondary">{groups.length}</Badge>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="hidden lg:flex">
          <Plus className="size-4" />
          New Group
        </Button>
      </div>

      {/* Group grid */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center dark:border-slate-700/70 dark:bg-slate-900/60">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const isOwner = group.ownerId === currentUserId;

            return (
              <Card key={group.id} className="gap-4">
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

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {group.members.length}{" "}
                      {group.members.length === 1 ? "member" : "members"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      {formatDate(group.createdAt)}
                    </span>
                  </div>

                  {isOwner && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <Crown className="size-3" />
                      You own this group
                    </div>
                  )}

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
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                    {!isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMembersGroup(group)}
                      >
                        <Users className="size-3.5" />
                        View Members
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      <Button
        className="fixed bottom-20 right-4 z-40 size-14 rounded-full shadow-lg lg:hidden"
        size="icon-lg"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="size-6" />
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

      {/* Members dialog */}
      <Dialog open={!!membersGroup} onOpenChange={() => setMembersGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Manage Members - {membersGroup?.name}
            </DialogTitle>
            <DialogDescription>
              Add or remove members from this group.
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
