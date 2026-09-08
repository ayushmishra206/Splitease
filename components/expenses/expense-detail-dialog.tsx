"use client";

import { Calendar, Pencil, Receipt, Repeat, StickyNote, Trash2, User } from "lucide-react";
import { formatCurrency, joinNames, cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/dates";
import { CATEGORIES, type ExpenseCategory } from "@/lib/categories";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Presentation model for one expense, independent of where it was loaded from. */
export type ExpenseView = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  splitType: string;
  expenseDate: Date | string;
  notes: string | null;
  receiptUrl: string | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  createdByName?: string;
  payers: Array<{ memberId: string; name: string; amount: number }>;
  splits: Array<{ memberId: string; name: string; share: number }>;
};

interface ExpenseDetailDialogProps {
  expense: ExpenseView | null;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "weekly",
  biweekly: "every 2 weeks",
  monthly: "monthly",
  yearly: "yearly",
};

export function payerSummary(
  payers: Array<{ memberId: string; name: string }>,
  currentUserId: string
): string {
  if (payers.length === 0) return "Unknown";
  const names = payers.map((p) => (p.memberId === currentUserId ? "You" : p.name));
  // Put "You" first for readability
  names.sort((a, b) => (a === "You" ? -1 : b === "You" ? 1 : 0));
  if (names.length > 3) return `${names[0]} and ${names.length - 1} others`;
  return joinNames(names);
}

export function ExpenseDetailDialog({
  expense,
  currentUserId,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: ExpenseDetailDialogProps) {
  const open = expense !== null;
  const category = expense?.category ? CATEGORIES[expense.category as ExpenseCategory] : undefined;
  const myShare = expense?.splits.find((s) => s.memberId === currentUserId)?.share ?? 0;
  const myPaid = expense?.payers.filter((p) => p.memberId === currentUserId).reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const myNet = myPaid - myShare;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {expense && (
          <>
            <DialogHeader className="text-left">
              <div className="flex items-start gap-3">
                <CategoryBadge category={expense.category ?? undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-lg">{expense.description}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {category ? `${category.label} · ` : ""}
                    {formatDateOnly(expense.expenseDate)}
                  </DialogDescription>
                </div>
                <span className="shrink-0 font-mono text-xl font-semibold tabular-nums">
                  {formatCurrency(expense.amount, expense.currency)}
                </span>
              </div>
            </DialogHeader>

            {/* Your position on this expense */}
            {(myShare > 0 || myPaid > 0) && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  myNet > 0.005
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : myNet < -0.005
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                      : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                {myNet > 0.005
                  ? `You lent ${formatCurrency(myNet, expense.currency)} on this expense`
                  : myNet < -0.005
                    ? `You borrowed ${formatCurrency(Math.abs(myNet), expense.currency)} on this expense`
                    : "You are even on this expense"}
              </div>
            )}

            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <User className="size-3.5" /> Paid by
                </p>
                <ul className="divide-y rounded-lg border">
                  {expense.payers.map((p) => (
                    <li key={p.memberId} className="flex items-center justify-between px-3 py-2">
                      <span className="truncate">{p.memberId === currentUserId ? "You" : p.name}</span>
                      <span className="font-mono tabular-nums">{formatCurrency(p.amount, expense.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Receipt className="size-3.5" /> Split {expense.splitType === "equal" ? "equally" : "by " + expense.splitType}
                </p>
                <ul className="divide-y rounded-lg border">
                  {expense.splits.map((s) => (
                    <li key={s.memberId} className="flex items-center justify-between px-3 py-2">
                      <span className="truncate">{s.memberId === currentUserId ? "You" : s.name}</span>
                      <span className="font-mono tabular-nums">{formatCurrency(s.share, expense.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {expense.notes && (
                <p className="flex items-start gap-1.5 text-muted-foreground">
                  <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                  <span className="whitespace-pre-wrap">{expense.notes}</span>
                </p>
              )}

              {expense.isRecurring && expense.recurrenceRule && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Repeat className="size-3.5" />
                  Repeats {RECURRENCE_LABELS[expense.recurrenceRule] ?? expense.recurrenceRule}
                </p>
              )}

              {expense.receiptUrl && (
                <a
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote receipt, size unknown */}
                  <img src={expense.receiptUrl} alt="Receipt" className="max-h-56 w-full object-cover" />
                </a>
              )}

              {expense.createdByName && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Added by {expense.createdByName}
                </p>
              )}
            </div>

            {(canEdit || canDelete) && (
              <div className="flex gap-2 pt-1">
                {canEdit && (
                  <Button variant="outline" className="flex-1" onClick={onEdit}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" className="flex-1 text-red-600 dark:text-red-400" onClick={onDelete}>
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
