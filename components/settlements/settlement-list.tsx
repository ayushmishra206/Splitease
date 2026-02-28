"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSettlement, updateSettlement, deleteSettlement } from "@/actions/settlements";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Filter,
  HandCoins,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SettlementForm } from "./settlement-form";

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

type SettlementWithDetails = {
  id: string;
  groupId: string;
  fromMember: string;
  toMember: string;
  amount: unknown; // Prisma Decimal
  settlementDate: Date;
  notes: string | null;
  createdAt: Date;
  group: {
    id: string;
    name: string;
    currency: string;
  };
  from: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  to: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
};

interface SettlementListProps {
  settlements: SettlementWithDetails[];
  groups: GroupWithMembers[];
  currentUserId: string;
}

export function SettlementList({
  settlements,
  groups,
  currentUserId,
}: SettlementListProps) {
  const router = useRouter();

  const [filterGroupId, setFilterGroupId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editSettlement, setEditSettlement] = useState<SettlementWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettlementWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredSettlements = useMemo(() => {
    if (filterGroupId === "all") return settlements;
    return settlements.filter((s) => s.groupId === filterGroupId);
  }, [settlements, filterGroupId]);

  const toNumber = (val: unknown): number => {
    if (typeof val === "number") return val;
    return parseFloat(String(val));
  };

  const formatDate = (date: Date) => format(new Date(date), "MMM d, yyyy");

  const getName = (profile: { id: string; fullName: string | null }) =>
    profile.id === currentUserId ? "You" : profile.fullName ?? "Unknown";

  const handleCreate = async (data: {
    groupId: string;
    fromMember: string;
    toMember: string;
    amount: number;
    settlementDate: string;
    notes?: string;
  }) => {
    try {
      await createSettlement(data);
      toast.success("Settlement recorded");
      setCreateOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to record settlement");
    }
  };

  const handleUpdate = async (data: {
    groupId: string;
    fromMember: string;
    toMember: string;
    amount: number;
    settlementDate: string;
    notes?: string;
  }) => {
    if (!editSettlement) return;
    try {
      await updateSettlement({ id: editSettlement.id, ...data });
      toast.success("Settlement updated");
      setEditSettlement(null);
      router.refresh();
    } catch {
      toast.error("Failed to update settlement");
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
    } catch {
      toast.error("Failed to delete settlement");
    } finally {
      setDeleting(false);
    }
  };

  const buildEditDefaults = (s: SettlementWithDetails) => ({
    groupId: s.groupId,
    fromMember: s.fromMember,
    toMember: s.toMember,
    amount: toNumber(s.amount),
    settlementDate: format(new Date(s.settlementDate), "yyyy-MM-dd"),
    notes: s.notes ?? undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Settlements</h1>
          <Badge variant="secondary">{filteredSettlements.length}</Badge>
        </div>
        <div className="flex items-center gap-3">
          {groups.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select value={filterGroupId} onValueChange={setFilterGroupId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={() => setCreateOpen(true)} className="hidden lg:flex">
            <Plus className="size-4" />
            New Settlement
          </Button>
        </div>
      </div>

      {/* Empty states */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center dark:border-slate-700/70 dark:bg-slate-900/60">
          <Users className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No groups yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a group first before recording settlements.
          </p>
          <Button onClick={() => router.push("/groups")} className="mt-6">
            Go to Groups
          </Button>
        </div>
      ) : filteredSettlements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center dark:border-slate-700/70 dark:bg-slate-900/60">
          <HandCoins className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No settlements yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record a payment to settle debts between group members.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-6">
            <Plus className="size-4" />
            Record Settlement
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredSettlements.map((settlement) => {
            const amount = toNumber(settlement.amount);

            return (
              <Card key={settlement.id} className="gap-3">
                <CardHeader className="pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5">
                        <Badge variant="outline" className="text-xs">
                          {settlement.group.name}
                        </Badge>
                      </div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="truncate font-medium">
                          {getName(settlement.from)}
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {getName(settlement.to)}
                        </span>
                      </CardTitle>
                    </div>
                    <span className="shrink-0 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(amount, settlement.group.currency)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      {formatDate(settlement.settlementDate)}
                    </span>
                  </div>

                  {settlement.notes && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2">{settlement.notes}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditSettlement(settlement)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      onClick={() => setDeleteTarget(settlement)}
                    >
                      <Trash2 className="size-3.5 text-red-500 dark:text-red-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      {groups.length > 0 && (
        <Button
          className="fixed bottom-20 right-4 z-40 size-14 rounded-full shadow-lg lg:hidden"
          size="icon-lg"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-6" />
        </Button>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Settlement</DialogTitle>
            <DialogDescription>
              Record a payment between group members.
            </DialogDescription>
          </DialogHeader>
          <SettlementForm
            groups={groups}
            currentUserId={currentUserId}
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editSettlement} onOpenChange={() => setEditSettlement(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Settlement</DialogTitle>
            <DialogDescription>
              Update settlement details.
            </DialogDescription>
          </DialogHeader>
          {editSettlement && (
            <SettlementForm
              groups={groups}
              currentUserId={currentUserId}
              defaultValues={buildEditDefaults(editSettlement)}
              onSubmit={handleUpdate}
              onCancel={() => setEditSettlement(null)}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Settlement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this settlement of{" "}
              {deleteTarget && formatCurrency(toNumber(deleteTarget.amount), deleteTarget.group.currency)}?
              This action cannot be undone.
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
    </div>
  );
}
