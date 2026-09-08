import { roundMoney } from "@/lib/money";

/**
 * Types and helpers shared by the expense server actions and client UI.
 * Kept free of server-only imports so client components can use them.
 */

export type ExpensePayerEntry = { memberId: string; amount: number };

/**
 * Normalise a payer list for storage. Drops zero rows, rounds, and picks the
 * "primary" payer (largest contribution, ties broken by list order) which is
 * stored in the legacy `payerId` column for compatibility.
 */
export function normalizePayers(
  payers: ExpensePayerEntry[] | undefined,
  fallbackPayerId: string,
  amount: number
): { payers: ExpensePayerEntry[]; primaryPayerId: string } {
  const cleaned = (payers ?? [])
    .map((p) => ({ memberId: p.memberId, amount: roundMoney(p.amount) }))
    .filter((p) => p.amount > 0);

  if (cleaned.length === 0) {
    return {
      payers: [{ memberId: fallbackPayerId, amount: roundMoney(amount) }],
      primaryPayerId: fallbackPayerId,
    };
  }

  let primary = cleaned[0];
  for (const p of cleaned) if (p.amount > primary.amount) primary = p;
  return { payers: cleaned, primaryPayerId: primary.memberId };
}

/** Compute the next occurrence for a recurring expense. */
export function computeNextOccurrence(date: Date, rule: string): Date {
  const next = new Date(date);
  switch (rule) {
    case "weekly": next.setUTCDate(next.getUTCDate() + 7); break;
    case "biweekly": next.setUTCDate(next.getUTCDate() + 14); break;
    case "monthly": next.setUTCMonth(next.getUTCMonth() + 1); break;
    case "yearly": next.setUTCFullYear(next.getUTCFullYear() + 1); break;
  }
  return next;
}

/** Minimal expense shape needed to pre-fill the edit form. */
export type EditableExpense = {
  groupId: string;
  description: string;
  amount: number;
  category: string | null;
  payerId: string | null;
  payers: ExpensePayerEntry[];
  expenseDate: Date | string;
  notes: string | null;
  receiptUrl: string | null;
  splitType: string;
  splits: Array<{ memberId: string; share: number }>;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
};

/** Build `ExpenseForm` default values from a stored expense. */
export function buildExpenseFormDefaults(expense: EditableExpense, dateKey: (d: Date | string) => string) {
  const customSplits: Record<string, number> = {};
  for (const s of expense.splits) customSplits[s.memberId] = s.share;
  const payers = expense.payers.length > 0
    ? expense.payers
    : expense.payerId
      ? [{ memberId: expense.payerId, amount: expense.amount }]
      : [];
  return {
    groupId: expense.groupId,
    description: expense.description,
    amount: expense.amount,
    category: expense.category ?? undefined,
    payerId: expense.payerId ?? payers[0]?.memberId ?? "",
    payers,
    expenseDate: dateKey(expense.expenseDate),
    notes: expense.notes ?? undefined,
    receiptUrl: expense.receiptUrl ?? undefined,
    splitType: expense.splitType,
    customSplits,
    participantIds: expense.splits.map((s) => s.memberId),
    isRecurring: expense.isRecurring ?? false,
    recurrenceRule: expense.recurrenceRule ?? undefined,
  };
}
