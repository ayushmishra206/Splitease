"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateExpense, deleteExpense, fetchExpenses, type ExpenseWithDetails } from "@/actions/expenses";
import { toast } from "sonner";
import {
  Calendar,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { dateOnlyKey, formatDateOnly } from "@/lib/dates";
import { CATEGORIES, type ExpenseCategory } from "@/lib/categories";
import { buildExpenseFormDefaults } from "@/lib/expenses-shared";
import type { ExpenseInput } from "@/lib/validation";
import type { GroupWithMembers } from "@/lib/types";
import { useQuickAdd } from "@/components/quick-add-expense";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { CategoryBadge } from "@/components/ui/category-badge";
import { ExpenseForm } from "./expense-form";
import { payerSummary } from "./expense-detail-dialog";

interface ExpenseListProps {
  initialExpenses: ExpenseWithDetails[];
  initialNextCursor: string | null;
  groups: GroupWithMembers[];
  currentUserId: string;
}

export function ExpenseList({ initialExpenses, initialNextCursor, groups, currentUserId }: ExpenseListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open: openQuickAdd } = useQuickAdd();

  const [allExpenses, setAllExpenses] = useState<ExpenseWithDetails[]>(initialExpenses);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterGroupId, setFilterGroupId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<ExpenseWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasActiveFilters = filterGroupId !== "all" || filterCategory !== "all" || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setFilterGroupId("all");
    setFilterCategory("all");
    setDateFrom("");
    setDateTo("");
  };

  // Deep links (e.g. /expenses?create=true&group=<id>) open the global sheet once,
  // then the query is removed so it cannot re-trigger after refreshes.
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      openQuickAdd({ groupId: searchParams.get("group") ?? undefined });
      router.replace("/expenses");
    }
  }, [searchParams, openQuickAdd, router]);

  // Sync local state when server props change (after router.refresh())
  useEffect(() => {
    setAllExpenses(initialExpenses);
    setNextCursor(initialNextCursor);
  }, [initialExpenses, initialNextCursor]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await fetchExpenses(filterGroupId !== "all" ? filterGroupId : undefined, nextCursor);
      setAllExpenses((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...result.items.filter((e) => !seen.has(e.id))];
      });
      setNextCursor(result.nextCursor);
    } catch {
      toast.error("Failed to load more expenses");
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    let result = allExpenses;
    if (filterGroupId !== "all") result = result.filter((e) => e.groupId === filterGroupId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) => e.description.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== "all") result = result.filter((e) => e.category === filterCategory);
    if (dateFrom) result = result.filter((e) => dateOnlyKey(e.expenseDate) >= dateFrom);
    if (dateTo) result = result.filter((e) => dateOnlyKey(e.expenseDate) <= dateTo);
    return result;
  }, [allExpenses, filterGroupId, searchQuery, filterCategory, dateFrom, dateTo]);

  const filteredTotal = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    for (const e of filteredExpenses) {
      byCurrency[e.group.currency] = (byCurrency[e.group.currency] ?? 0) + e.amount;
    }
    return byCurrency;
  }, [filteredExpenses]);

  const handleUpdate = async (data: ExpenseInput) => {
    if (!editExpense) return;
    try {
      await updateExpense({ id: editExpense.id, ...data });
      toast.success("Expense updated");
      setEditExpense(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update expense");
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete expense");
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (expense: ExpenseWithDetails) =>
    expense.createdById === currentUserId ||
    expense.payers.some((p) => p.memberId === currentUserId) ||
    expense.group.ownerId === currentUserId;

  const editGroup = editExpense ? groups.find((g) => g.id === editExpense.groupId) : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl">Expenses</h1>
          <Badge variant="secondary">{filteredExpenses.length}</Badge>
        </div>
        {groups.length > 0 && (
          <Button onClick={() => openQuickAdd()} className="hidden md:inline-flex">
            <Plus className="size-4" />
            New Expense
          </Button>
        )}
      </div>

      {/* Search & filters */}
      {groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                type="search"
                enterKeyHint="search"
              />
            </div>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="icon"
              className="sm:hidden"
              aria-label="Toggle filters"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>

          <div className={cn("flex-wrap items-center gap-2 sm:flex", filtersOpen ? "flex" : "hidden")}>
            <Select value={filterGroupId} onValueChange={setFilterGroupId}>
              <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filter by group">
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
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(Object.entries(CATEGORIES) as [ExpenseCategory, { emoji: string; label: string }][]).map(
                  ([key, { emoji, label }]) => (
                    <SelectItem key={key} value={key}>
                      {emoji} {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-w-0 flex-1 sm:w-[140px] sm:flex-none"
                aria-label="From date"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-w-0 flex-1 sm:w-[140px] sm:flex-none"
                aria-label="To date"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>

          {filteredExpenses.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredExpenses.length} expense{filteredExpenses.length === 1 ? "" : "s"} totalling{" "}
              {Object.entries(filteredTotal)
                .map(([currency, total]) => formatCurrency(total, currency))
                .join(" + ")}
              {nextCursor ? " (more available)" : ""}
            </p>
          )}
        </div>
      )}

      {/* Empty states */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center sm:p-16">
          <Users className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No groups yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a group first before adding expenses.</p>
          <Button onClick={() => router.push("/groups")} className="mt-6">
            Go to Groups
          </Button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center sm:p-16">
          <Receipt className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">
            {hasActiveFilters || searchQuery ? "No matching expenses" : "No expenses yet"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters || searchQuery
              ? "Try a different search or clear the filters."
              : "Add your first expense to start tracking spending."}
          </p>
          {hasActiveFilters || searchQuery ? (
            <Button variant="outline" onClick={() => { clearFilters(); setSearchQuery(""); }} className="mt-6">
              Clear filters
            </Button>
          ) : (
            <Button onClick={() => openQuickAdd()} className="mt-6">
              <Plus className="size-4" />
              Add Expense
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            {filteredExpenses.map((expense) => {
              const iPaid = expense.payers.some((p) => p.memberId === currentUserId);
              const myShare = expense.splits.find((s) => s.memberId === currentUserId)?.share ?? 0;
              const myPaid = expense.payers
                .filter((p) => p.memberId === currentUserId)
                .reduce((sum, p) => sum + p.amount, 0);
              const myNet = myPaid - myShare;

              return (
                <Card key={expense.id} className="gap-3 py-4 sm:py-5">
                  <CardHeader className="px-4 pb-0 sm:px-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {expense.group.name}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <CategoryBadge category={expense.category ?? undefined} />
                          <CardTitle className="truncate text-base">{expense.description}</CardTitle>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={cn(
                            "font-mono text-lg font-semibold tabular-nums",
                            iPaid ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                          )}
                        >
                          {formatCurrency(expense.amount, expense.group.currency)}
                        </span>
                        {Math.abs(myNet) > 0.005 && (
                          <p className={cn("text-xs font-medium", myNet > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {myNet > 0 ? `you lent ${formatCurrency(myNet, expense.group.currency)}` : `you owe ${formatCurrency(-myNet, expense.group.currency)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 px-4 sm:px-6">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatDateOnly(expense.expenseDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="size-3.5" />
                        Paid by{" "}
                        <span className="font-medium text-foreground">
                          {payerSummary(
                            expense.payers.map((p) => ({ memberId: p.memberId, name: p.member.fullName ?? "Unknown" })),
                            currentUserId
                          )}
                        </span>
                      </span>
                    </div>

                    {expense.payers.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {expense.payers.map((p) => (
                          <Badge key={p.id} variant="outline" className="text-xs font-normal">
                            {p.memberId === currentUserId ? "You" : p.member.fullName ?? "Unknown"} paid{" "}
                            {formatCurrency(p.amount, expense.group.currency)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="size-3" />
                        Split between {expense.splits.length} {expense.splits.length === 1 ? "person" : "people"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {expense.splits.map((split) => (
                          <Badge key={split.id} variant="secondary" className="text-xs font-normal">
                            {split.member.id === currentUserId ? "You" : split.member.fullName ?? "Unknown"}:{" "}
                            {formatCurrency(split.share, expense.group.currency)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {expense.notes && (
                      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                        <span className="line-clamp-2">{expense.notes}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => setEditExpense(expense)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      {expense.receiptUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
                            <Receipt className="size-3.5" />
                            Receipt
                          </a>
                        </Button>
                      )}
                      {canDelete(expense) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="ml-auto"
                          aria-label="Delete expense"
                          onClick={() => setDeleteTarget(expense)}
                        >
                          <Trash2 className="size-3.5 text-red-500 dark:text-red-400" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {nextCursor && (
            <div className="flex justify-center pt-2 sm:pt-4">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} className="w-full sm:w-auto">
                {loadingMore ? "Loading..." : "Load more expenses"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editExpense} onOpenChange={(v) => !v && setEditExpense(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
            <DialogDescription>
              {editExpense && editExpense.createdById && editExpense.createdById !== currentUserId
                ? `Added by ${editExpense.createdBy?.fullName ?? "another member"}. They will be notified of your changes.`
                : "Update the details and how it is split."}
            </DialogDescription>
          </DialogHeader>
          {editExpense && editGroup && (
            <ExpenseForm
              groups={[editGroup]}
              currentUserId={currentUserId}
              lockGroup
              defaultValues={buildExpenseFormDefaults(editExpense, dateOnlyKey)}
              onSubmit={handleUpdate}
              onCancel={() => setEditExpense(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.description}&quot;? This permanently removes the expense and its splits and
              cannot be undone.
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
