"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { computeEqualSplit, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const expenseSchema = z.object({
  groupId: z.string().min(1, "Select a group"),
  description: z.string().min(1, "Description is required").max(120),
  amount: z.number().positive("Must be positive"),
  payerId: z.string().min(1, "Select who paid"),
  expenseDate: z.string().min(1, "Date is required"),
  notes: z.string().max(240).optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

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

interface ExpenseFormProps {
  groups: GroupWithMembers[];
  currentUserId: string;
  defaultValues?: {
    groupId: string;
    description: string;
    amount: number;
    payerId: string;
    expenseDate: string;
    notes?: string;
    splitMethod: "equal" | "custom";
    customSplits?: Record<string, number>;
    participantIds?: string[];
  };
  onSubmit: (data: {
    groupId: string;
    description: string;
    amount: number;
    payerId: string;
    expenseDate: string;
    notes?: string;
    splits: { memberId: string; share: number }[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function ExpenseForm({
  groups,
  currentUserId,
  defaultValues,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      groupId: defaultValues?.groupId ?? "",
      description: defaultValues?.description ?? "",
      amount: defaultValues?.amount ?? (undefined as unknown as number),
      payerId: defaultValues?.payerId ?? "",
      expenseDate: defaultValues?.expenseDate ?? today,
      notes: defaultValues?.notes ?? "",
    },
  });

  const groupId = watch("groupId");
  const amount = watch("amount");
  const validAmount = typeof amount === "number" && amount > 0 ? amount : 0;

  const [splitMethod, setSplitMethod] = useState<"equal" | "custom">(
    defaultValues?.splitMethod ?? "equal"
  );
  const [participantIds, setParticipantIds] = useState<string[]>(
    defaultValues?.participantIds ?? []
  );
  const [customSplits, setCustomSplits] = useState<Record<string, number>>(
    defaultValues?.customSplits ?? {}
  );
  const [splitError, setSplitError] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === groupId),
    [groups, groupId]
  );

  const members = useMemo(
    () => selectedGroup?.members ?? [],
    [selectedGroup]
  );

  const currency = selectedGroup?.currency ?? "USD";

  // When group changes (and not on initial mount with defaults), reset participants and payer
  const resetForGroup = useCallback(
    (gId: string) => {
      const group = groups.find((g) => g.id === gId);
      if (!group) return;

      const allMemberIds = group.members.map((m) => m.memberId);
      setParticipantIds(allMemberIds);

      // Set payer to current user if they're a member, otherwise first member
      const payerDefault = allMemberIds.includes(currentUserId)
        ? currentUserId
        : allMemberIds[0] ?? "";
      setValue("payerId", payerDefault);

      // Reset custom splits
      const newCustomSplits: Record<string, number> = {};
      allMemberIds.forEach((id) => {
        newCustomSplits[id] = 0;
      });
      setCustomSplits(newCustomSplits);
      setSplitMethod("equal");
    },
    [groups, currentUserId, setValue]
  );

  // Handle initial setup - only on first render when there's no default but a group exists
  useEffect(() => {
    if (!defaultValues && groupId) {
      resetForGroup(groupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGroupChange = (newGroupId: string) => {
    setValue("groupId", newGroupId);
    resetForGroup(newGroupId);
  };

  const handleParticipantToggle = (memberId: string) => {
    setParticipantIds((prev) => {
      const next = prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];

      // Update custom splits when participants change
      const updated = { ...customSplits };
      if (!next.includes(memberId)) {
        delete updated[memberId];
      } else if (!(memberId in updated)) {
        updated[memberId] = 0;
      }
      setCustomSplits(updated);

      return next;
    });
  };

  const handleCustomSplitChange = (memberId: string, value: string) => {
    const num = parseFloat(value) || 0;
    setCustomSplits((prev) => ({ ...prev, [memberId]: num }));
  };

  // Equal split preview
  const equalShares = useMemo(() => {
    if (participantIds.length === 0 || validAmount <= 0) return [];
    return computeEqualSplit(validAmount, participantIds.length);
  }, [validAmount, participantIds.length]);

  // Custom split total
  const customTotal = useMemo(() => {
    return participantIds.reduce((sum, id) => sum + (customSplits[id] ?? 0), 0);
  }, [participantIds, customSplits]);

  const customDiff = validAmount - customTotal;

  // Validate splits before submit
  const validateSplits = (): { memberId: string; share: number }[] | null => {
    if (participantIds.length === 0) {
      setSplitError("Select at least one participant");
      return null;
    }

    if (splitMethod === "equal") {
      setSplitError(null);
      return participantIds.map((id, i) => ({
        memberId: id,
        share: equalShares[i] ?? 0,
      }));
    }

    // Custom: validate sum matches amount within tolerance
    if (Math.abs(customDiff) > 0.01) {
      setSplitError(
        `Split total (${formatCurrency(customTotal, currency)}) must equal expense amount (${formatCurrency(validAmount, currency)})`
      );
      return null;
    }

    setSplitError(null);
    return participantIds.map((id) => ({
      memberId: id,
      share: customSplits[id] ?? 0,
    }));
  };

  const onFormSubmit = async (data: ExpenseFormValues) => {
    const splits = validateSplits();
    if (!splits) return;

    await onSubmit({
      groupId: data.groupId,
      description: data.description,
      amount: data.amount,
      payerId: data.payerId,
      expenseDate: data.expenseDate,
      notes: data.notes || undefined,
      splits,
    });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Group */}
      <div className="space-y-2">
        <Label htmlFor="groupId">Group</Label>
        <Select value={groupId} onValueChange={handleGroupChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name} ({g.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.groupId && (
          <p className="text-sm text-destructive">{errors.groupId.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="e.g. Dinner, Groceries, Taxi"
          {...register("description")}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Amount & Date row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="font-mono"
            {...register("amount")}
            aria-invalid={!!errors.amount}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="expenseDate">Date</Label>
          <Input
            id="expenseDate"
            type="date"
            max={today}
            {...register("expenseDate")}
            aria-invalid={!!errors.expenseDate}
          />
          {errors.expenseDate && (
            <p className="text-sm text-destructive">{errors.expenseDate.message}</p>
          )}
        </div>
      </div>

      {/* Payer */}
      {groupId && members.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="payerId">Who Paid</Label>
          <Select
            value={watch("payerId")}
            onValueChange={(val) => setValue("payerId", val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select who paid" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.memberId} value={m.memberId}>
                  {m.member.id === currentUserId
                    ? `${m.member.fullName ?? "You"} (You)`
                    : m.member.fullName ?? "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.payerId && (
            <p className="text-sm text-destructive">{errors.payerId.message}</p>
          )}
        </div>
      )}

      {/* Participants */}
      {groupId && members.length > 0 && (
        <div className="space-y-2">
          <Label>Participants</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((m) => {
              const checked = participantIds.includes(m.memberId);
              return (
                <label
                  key={m.memberId}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => handleParticipantToggle(m.memberId)}
                  />
                  <span className="truncate">
                    {m.member.id === currentUserId
                      ? "You"
                      : m.member.fullName ?? "Unknown"}
                  </span>
                </label>
              );
            })}
          </div>
          {splitError && participantIds.length === 0 && (
            <p className="text-sm text-destructive">Select at least one participant</p>
          )}
        </div>
      )}

      {/* Split method */}
      {groupId && participantIds.length > 0 && (
        <div className="space-y-3">
          <Label>Split Method</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={splitMethod === "equal" ? "default" : "outline"}
              onClick={() => setSplitMethod("equal")}
            >
              Equal
            </Button>
            <Button
              type="button"
              size="sm"
              variant={splitMethod === "custom" ? "default" : "outline"}
              onClick={() => setSplitMethod("custom")}
            >
              Custom
            </Button>
          </div>

          {/* Equal split preview */}
          {splitMethod === "equal" && validAmount > 0 && (
            <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Each person pays
              </p>
              <div className="flex flex-wrap gap-1.5">
                {participantIds.map((id, i) => {
                  const member = members.find((m) => m.memberId === id);
                  return (
                    <Badge key={id} variant="secondary" className="text-xs font-normal">
                      {member?.member.id === currentUserId
                        ? "You"
                        : member?.member.fullName ?? "Unknown"}
                      :{" "}
                      {formatCurrency(equalShares[i] ?? 0, currency)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom split inputs */}
          {splitMethod === "custom" && (
            <div className="space-y-2">
              {participantIds.map((id) => {
                const member = members.find((m) => m.memberId === id);
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {member?.member.id === currentUserId
                        ? "You"
                        : member?.member.fullName ?? "Unknown"}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-28"
                      value={customSplits[id] ?? ""}
                      onChange={(e) => handleCustomSplitChange(id, e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                );
              })}

              {/* Running total */}
              {validAmount > 0 && (
                <div
                  className={`flex items-center justify-between rounded-md border p-2 text-sm ${
                    Math.abs(customDiff) <= 0.01
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                  }`}
                >
                  <span>
                    Total: {formatCurrency(customTotal, currency)} /{" "}
                    {formatCurrency(validAmount, currency)}
                  </span>
                  {Math.abs(customDiff) > 0.01 && (
                    <span className="font-medium">
                      {customDiff > 0
                        ? `${formatCurrency(customDiff, currency)} remaining`
                        : `${formatCurrency(Math.abs(customDiff), currency)} over`}
                    </span>
                  )}
                </div>
              )}

              {splitError && (
                <p className="text-sm text-destructive">{splitError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Add any notes..."
          maxLength={240}
          {...register("notes")}
          aria-invalid={!!errors.notes}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : defaultValues
              ? "Save Changes"
              : "Add Expense"}
        </Button>
      </div>
    </form>
  );
}
