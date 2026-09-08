"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createSettlement,
  updateSettlement,
  deleteSettlement,
  type SettlementWithDetails,
} from "@/actions/settlements";
import { toast } from "sonner";
import { ArrowRight, Calendar, HandCoins, Pencil, Plus, StickyNote, Trash2, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { dateOnlyKey, formatDateOnly } from "@/lib/dates";
import type { SettlementInput } from "@/lib/validation";
import type { GroupWithMembers } from "@/lib/types";
import { isArchived } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SettlementForm } from "./settlement-form";

interface SettlementListProps {
  settlements: SettlementWithDetails[];
  groups: GroupWithMembers[];
  currentUserId: string;
}

export function SettlementList({ settlements, groups, currentUserId }: SettlementListProps) {
  const router = useRouter();

  const [filterGroupId, setFilterGroupId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editSettlement, setEditSettlement] = useState<SettlementWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettlementWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeGroups = useMemo(() => groups.filter((g) => !isArchived(g)), [groups]);

  const filteredSettlements = useMemo(() => {
    if (filterGroupId === "all") return settlements;
    return settlements.filter((s) => s.groupId === filterGroupId);
  }, [settlements, filterGroupId]);

  const getName = (profile: { id: string; fullName: string | null }) =>
    profile.id === currentUserId ? "You" : profile.fullName ?? "Unknown";

  const handleCreate = async (data: SettlementInput) => {
    try {
      await createSettlement(data);
      toast.success("Settlement recorded");
      setCreateOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record settlement");
    }
  };

  const handleUpdate = async (data: SettlementInput) => {
    if (!editSettlement) return;
    try {
      await updateSettlement({ id: editSettlement.id, ...data });
      toast.success("Settlement updated");
      setEditSettlement(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settlement");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSettlement(deleteTarget.id);
      toast.success("Settlement deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete settlement");
    } finally {
      setDeleting(false);
    }
  };

  const buildEditDefaults = (s: SettlementWithDetails): SettlementInput => ({
    groupId: s.groupId,
    fromMember: s.fromMember,
    toMember: s.toMember,
    amount: s.amount,
    settlementDate: dateOnlyKey(s.settlementDate),
    notes: s.notes ?? undefined,
  });

  const editGroup = editSettlement ? groups.find((g) => g.id === editSettlement.groupId) : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl">Settlements</h1>
          <Badge variant="secondary">{filteredSettlements.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 1 && (
            <Select value={filterGroupId} onValueChange={setFilterGroupId}>
              <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by group">
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeGroups.length > 0 && (
            <Button onClick={() => setCreateOpen(true)} className="hidden md:inline-flex">
              <Plus className="size-4" />
              New Settlement
            </Button>
          )}
        </div>
      </div>

      {/* Empty states */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center sm:p-16">
          <Users className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No groups yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a group first before recording settlements.</p>
          <Button onClick={() => router.push("/groups")} className="mt-6">
            Go to Groups
          </Button>
        </div>
      ) : filteredSettlements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center sm:p-16">
          <HandCoins className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No settlements yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record a payment to settle debts between group members.
          </p>
          {activeGroups.length > 0 && (
            <Button onClick={() => setCreateOpen(true)} className="mt-6">
              <Plus className="size-4" />
              Record Settlement
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {filteredSettlements.map((settlement) => (
            <Card key={settlement.id} className="gap-3 py-4 sm:py-5">
              <CardHeader className="px-4 pb-0 sm:px-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5">
                      <Badge variant="outline" className="text-xs">
                        {settlement.group.name}
                      </Badge>
                    </div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="truncate font-medium">{getName(settlement.from)}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{getName(settlement.to)}</span>
                    </CardTitle>
                  </div>
                  <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(settlement.amount, settlement.group.currency)}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 px-4 sm:px-6">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    {formatDateOnly(settlement.settlementDate)}
                  </span>
                </div>

                {settlement.notes && (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                    <span className="line-clamp-2">{settlement.notes}</span>
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setEditSettlement(settlement)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label="Delete settlement"
                    onClick={() => setDeleteTarget(settlement)}
                  >
                    <Trash2 className="size-3.5 text-red-500 dark:text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      {activeGroups.length > 0 && (
        <Button
          className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden"
          size="icon-lg"
          aria-label="Record settlement"
          onClick={() => setCreateOpen(true)}
        >
          <HandCoins className="size-6" />
        </Button>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record settlement</DialogTitle>
            <DialogDescription>Record a payment between group members.</DialogDescription>
          </DialogHeader>
          {createOpen && (
            <SettlementForm
              groups={activeGroups}
              currentUserId={currentUserId}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editSettlement} onOpenChange={(v) => !v && setEditSettlement(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit settlement</DialogTitle>
            <DialogDescription>Update settlement details.</DialogDescription>
          </DialogHeader>
          {editSettlement && editGroup && (
            <SettlementForm
              groups={[editGroup]}
              currentUserId={currentUserId}
              lockGroup
              defaultValues={buildEditDefaults(editSettlement)}
              onSubmit={handleUpdate}
              onCancel={() => setEditSettlement(null)}
              submitLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete settlement</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this settlement of{" "}
              {deleteTarget && formatCurrency(deleteTarget.amount, deleteTarget.group.currency)}? Balances will
              go back to what they were before it was recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
