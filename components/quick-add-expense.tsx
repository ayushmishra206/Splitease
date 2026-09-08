"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExpense } from "@/actions/expenses";
import type { ExpenseInput } from "@/lib/validation";
import type { GroupWithMembers } from "@/lib/types";
import { isArchived } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseForm } from "@/components/expenses/expense-form";

type OpenOptions = { groupId?: string };

type QuickAddContextValue = {
  /** Open the "Add expense" sheet, optionally pre-selecting a group. */
  open: (options?: OpenOptions) => void;
  /** Whether at least one active group exists to add expenses to. */
  canAdd: boolean;
};

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function useQuickAdd(): QuickAddContextValue {
  const ctx = useContext(QuickAddContext);
  if (!ctx) {
    throw new Error("useQuickAdd must be used inside <QuickAddProvider>");
  }
  return ctx;
}

interface QuickAddProviderProps {
  groups: GroupWithMembers[];
  currentUserId: string;
  children: React.ReactNode;
}

/**
 * Single, app-wide "Add expense" dialog. Every entry point (header button,
 * mobile nav, group page, empty states) opens this same sheet in place instead
 * of navigating, so it works from any page and never gets stuck closed.
 */
export function QuickAddProvider({ groups, currentUserId, children }: QuickAddProviderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  // Remount the form on every open so stale values never leak between uses
  const [formKey, setFormKey] = useState(0);

  const activeGroups = useMemo(() => groups.filter((g) => !isArchived(g)), [groups]);
  const canAdd = activeGroups.length > 0;

  const openDialog = useCallback(
    (options?: OpenOptions) => {
      if (activeGroups.length === 0) {
        toast.info("Create a group first, then add expenses to it.");
        router.push("/groups");
        return;
      }
      const requested = options?.groupId;
      setGroupId(requested && activeGroups.some((g) => g.id === requested) ? requested : undefined);
      setFormKey((k) => k + 1);
      setOpen(true);
    },
    [activeGroups, router]
  );

  const handleSubmit = async (data: ExpenseInput) => {
    try {
      await createExpense(data);
      toast.success("Expense added");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add expense");
    }
  };

  const value = useMemo(() => ({ open: openDialog, canAdd }), [openDialog, canAdd]);

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>Record a shared expense and split it with your group.</DialogDescription>
          </DialogHeader>
          {open && (
            <ExpenseForm
              key={formKey}
              groups={activeGroups}
              currentUserId={currentUserId}
              initialGroupId={groupId}
              onSubmit={handleSubmit}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </QuickAddContext.Provider>
  );
}
