"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createExpense } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseForm } from "@/components/expenses/expense-form";

type GroupWithMembers = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  status?: string;
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

interface QuickAddExpenseProps {
  groups: GroupWithMembers[];
  currentUserId: string;
}

export function QuickAddExpense({ groups, currentUserId }: QuickAddExpenseProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const activeGroups = groups.filter((g) => g.status !== "archived");
  if (activeGroups.length === 0) return null;

  const handleSubmit = async (data: {
    groupId: string;
    description: string;
    amount: number;
    category?: string;
    splitType?: string;
    payerId: string;
    expenseDate: string;
    notes?: string;
    splits: { memberId: string; share: number }[];
  }) => {
    try {
      await createExpense(data);
      toast.success("Expense created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create expense");
    }
  };

  return (
    <>
      {/* Desktop FAB - bottom right */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 hidden size-14 rounded-full shadow-lg md:flex"
        size="icon-lg"
        title="Quick add expense"
      >
        <Plus className="size-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Quick Add Expense</DialogTitle>
            <DialogDescription>
              Add a new expense to any group.
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            groups={groups}
            currentUserId={currentUserId}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
