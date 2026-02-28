"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createExpense, updateExpense, deleteExpense } from "@/actions/expenses";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Calendar,
  FileText,
  Filter,
  Pencil,
  Plus,
  Receipt,
  StickyNote,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { formatCurrency, computeEqualSplit } from "@/lib/utils";

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

import { CategoryBadge } from "@/components/ui/category-badge";
import { ExpenseForm } from "./expense-form";

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

type ExpenseWithDetails = {
  id: string;
  groupId: string;
  payerId: string | null;
  description: string;
  amount: unknown; // Prisma Decimal
  expenseDate: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  group: {
    id: string;
    name: string;
    currency: string;
  };
  payer: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  splits: Array<{
    id: string;
    expenseId: string;
    memberId: string;
    share: unknown; // Prisma Decimal
    member: {
      id: string;
      fullName: string | null;
      avatarUrl: string | null;
    };
  }>;
};

interface ExpenseListProps {
  expenses: ExpenseWithDetails[];
  groups: GroupWithMembers[];
  currentUserId: string;
}

export function ExpenseList({ expenses, groups, currentUserId }: ExpenseListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterGroupId, setFilterGroupId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<ExpenseWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-open create dialog when ?create=true
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const filteredExpenses = useMemo(() => {
    if (filterGroupId === "all") return expenses;
    return expenses.filter((e) => e.groupId === filterGroupId);
  }, [expenses, filterGroupId]);

  const handleCreate = async (data: {
    groupId: string;
    description: string;
    amount: number;
    payerId: string;
    expenseDate: string;
    notes?: string;
    splits: { memberId: string; share: number }[];
  }) => {
    try {
      await createExpense(data);
      toast.success("Expense created");
      setCreateOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create expense");
    }
  };

  const handleUpdate = async (data: {
    groupId: string;
    description: string;
    amount: number;
    payerId: string;
    expenseDate: string;
    notes?: string;
    splits: { memberId: string; share: number }[];
  }) => {
    if (!editExpense) return;
    try {
      await updateExpense({ id: editExpense.id, ...data });
      toast.success("Expense updated");
      setEditExpense(null);
      router.refresh();
    } catch {
      toast.error("Failed to update expense");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      toast.success("Expense deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete expense");
    } finally {
      setDeleting(false);
    }
  };

  const toNumber = (val: unknown): number => {
    if (typeof val === "number") return val;
    return parseFloat(String(val));
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), "MMM d, yyyy");
  };

  const buildEditDefaults = (expense: ExpenseWithDetails) => {
    const amount = toNumber(expense.amount);
    const splits = expense.splits;
    const participantIds = splits.map((s) => s.memberId);
    const shares = splits.map((s) => toNumber(s.share));

    // Determine if it was an equal split
    const equalShares = computeEqualSplit(amount, splits.length);
    const isEqual =
      equalShares.length === shares.length &&
      equalShares.every((es, i) => Math.abs(es - shares[i]) < 0.02);

    const customSplits: Record<string, number> = {};
    splits.forEach((s) => {
      customSplits[s.memberId] = toNumber(s.share);
    });

    return {
      groupId: expense.groupId,
      description: expense.description,
      amount,
      payerId: expense.payerId ?? "",
      expenseDate: format(new Date(expense.expenseDate), "yyyy-MM-dd"),
      notes: expense.notes ?? undefined,
      splitMethod: isEqual ? ("equal" as const) : ("custom" as const),
      customSplits,
      participantIds,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <Badge variant="secondary">{filteredExpenses.length}</Badge>
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
            New Expense
          </Button>
        </div>
      </div>

      {/* Empty states */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
          <Users className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No groups yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a group first before adding expenses.
          </p>
          <Button onClick={() => router.push("/groups")} className="mt-6">
            Go to Groups
          </Button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
          <Receipt className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No expenses yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first expense to start tracking spending.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-6">
            <Plus className="size-4" />
            Add Expense
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredExpenses.map((expense) => {
            const amount = toNumber(expense.amount);
            const isPayer = expense.payerId === currentUserId;

            return (
              <Card key={expense.id} className="gap-3">
                <CardHeader className="pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {expense.group.name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <CategoryBadge />
                        <CardTitle className="truncate text-base">
                          {expense.description}
                        </CardTitle>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-lg font-semibold font-mono ${
                        isPayer
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {formatCurrency(amount, expense.group.currency)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      {formatDate(expense.expenseDate)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User className="size-3.5" />
                      Paid by{" "}
                      <span className="font-medium text-foreground">
                        {expense.payer?.id === currentUserId
                          ? "You"
                          : expense.payer?.fullName ?? "Unknown"}
                      </span>
                    </span>
                  </div>

                  {/* Participant breakdown */}
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FileText className="size-3" />
                      Split between {expense.splits.length}{" "}
                      {expense.splits.length === 1 ? "person" : "people"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {expense.splits.map((split) => (
                        <Badge key={split.id} variant="secondary" className="text-xs font-normal">
                          {split.member.id === currentUserId
                            ? "You"
                            : split.member.fullName ?? "Unknown"}
                          :{" "}
                          {formatCurrency(toNumber(split.share), expense.group.currency)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {expense.notes && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2">{expense.notes}</span>
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditExpense(expense)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      onClick={() => setDeleteTarget(expense)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New Expense</DialogTitle>
            <DialogDescription>
              Add a new expense to split with your group.
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            groups={groups}
            currentUserId={currentUserId}
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editExpense} onOpenChange={() => setEditExpense(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense details and split.
            </DialogDescription>
          </DialogHeader>
          {editExpense && (
            <ExpenseForm
              groups={groups}
              currentUserId={currentUserId}
              defaultValues={buildEditDefaults(editExpense)}
              onSubmit={handleUpdate}
              onCancel={() => setEditExpense(null)}
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
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.description}&quot;?
              This will permanently remove this expense and its splits. This action
              cannot be undone.
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
