"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { computeEqualSplit, formatCurrency, displayName, cn } from "@/lib/utils";
import { isValidMoney, moneyEquals, parseAmount, roundMoney, sumMoney } from "@/lib/money";
import { todayIso } from "@/lib/dates";
import { CATEGORIES, type ExpenseCategory } from "@/lib/categories";
import { useUploadThing } from "@/lib/uploadthing";
import type { ExpenseInput } from "@/lib/validation";
import type { ExpensePayerEntry } from "@/lib/expenses-shared";
import type { GroupWithMembers } from "@/lib/types";
import { isArchived } from "@/lib/types";
import { Upload, X, Repeat, Mail, ChevronDown, Users } from "lucide-react";

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

type SplitType = "equal" | "percentage" | "shares" | "exact";
const SPLIT_LABELS: Record<SplitType, string> = {
  equal: "Equally",
  percentage: "By %",
  shares: "By shares",
  exact: "Exact amounts",
};

const expenseSchema = z.object({
  groupId: z.string().min(1, "Select a group"),
  description: z.string().trim().min(1, "Description is required").max(120, "Keep it under 120 characters"),
  amount: z
    .number({ message: "Enter an amount" })
    .positive("Amount must be greater than 0")
    .refine(isValidMoney, "Use at most 2 decimal places"),
  payerId: z.string().min(1, "Select who paid"),
  expenseDate: z.string().min(1, "Date is required"),
  notes: z.string().max(240, "Keep notes under 240 characters").optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export type ExpenseFormDefaults = {
  groupId: string;
  description: string;
  amount: number;
  category?: string;
  payerId: string;
  payers?: ExpensePayerEntry[];
  expenseDate: string;
  notes?: string;
  receiptUrl?: string;
  splitType?: string;
  customSplits?: Record<string, number>;
  participantIds?: string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
};

interface ExpenseFormProps {
  groups: GroupWithMembers[];
  currentUserId: string;
  /** Pre-select a group when creating. */
  initialGroupId?: string;
  /** Hide the group picker (editing, or adding from inside a group). */
  lockGroup?: boolean;
  defaultValues?: ExpenseFormDefaults;
  onSubmit: (data: ExpenseInput) => Promise<void>;
  onCancel: () => void;
}

function toInputString(value: number | undefined): string {
  return value === undefined || value === 0 ? "" : String(value);
}

export function ExpenseForm({
  groups,
  currentUserId,
  initialGroupId,
  lockGroup = false,
  defaultValues,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const today = todayIso();
  const isEditing = !!defaultValues;

  const selectableGroups = useMemo(
    () => groups.filter((g) => !isArchived(g) || g.id === defaultValues?.groupId),
    [groups, defaultValues?.groupId]
  );

  const resolvedInitialGroupId =
    defaultValues?.groupId ??
    (initialGroupId && selectableGroups.some((g) => g.id === initialGroupId)
      ? initialGroupId
      : selectableGroups[0]?.id ?? "");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      groupId: resolvedInitialGroupId,
      description: defaultValues?.description ?? "",
      // Left undefined on purpose: the resolver reports "Enter an amount" when empty
      amount: defaultValues?.amount,
      payerId:
        defaultValues?.payerId ??
        (groups.find((g) => g.id === resolvedInitialGroupId)?.members.some((m) => m.memberId === currentUserId)
          ? currentUserId
          : groups.find((g) => g.id === resolvedInitialGroupId)?.members[0]?.memberId ?? ""),
      expenseDate: defaultValues?.expenseDate ?? today,
      notes: defaultValues?.notes ?? "",
    },
  });

  const groupId = watch("groupId");
  const amount = watch("amount");
  const payerId = watch("payerId");
  const validAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : 0;

  const selectedGroup = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);
  const members = useMemo(() => selectedGroup?.members ?? [], [selectedGroup]);
  const currency = selectedGroup?.currency ?? "USD";
  const memberName = (memberId: string) =>
    displayName(members.find((m) => m.memberId === memberId)?.member, currentUserId);

  const [category, setCategory] = useState<string>(defaultValues?.category ?? "");

  // Who paid
  const [payerMode, setPayerMode] = useState<"single" | "multiple">(
    defaultValues?.payers && defaultValues.payers.length > 1 ? "multiple" : "single"
  );
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of defaultValues?.payers ?? []) initial[p.memberId] = toInputString(p.amount);
    return initial;
  });
  const [payerError, setPayerError] = useState<string | null>(null);

  // How it's split
  const initialSplitType: SplitType =
    defaultValues?.splitType === "equal" || !defaultValues
      ? "equal"
      : // Percentages and share weights are not stored, only the resulting amounts,
        // so any non-equal split is edited as exact amounts.
        "exact";
  const [splitMethod, setSplitMethod] = useState<SplitType>(initialSplitType);
  const [participantIds, setParticipantIds] = useState<string[]>(
    () => defaultValues?.participantIds ?? members.map((m) => m.memberId)
  );
  const [customSplits, setCustomSplits] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [id, share] of Object.entries(defaultValues?.customSplits ?? {})) {
      initial[id] = toInputString(share);
    }
    return initial;
  });
  const [splitError, setSplitError] = useState<string | null>(null);

  // Extras (collapsed by default on create to keep the sheet short on phones)
  const [showMore, setShowMore] = useState(
    !!(defaultValues?.notes || defaultValues?.receiptUrl || defaultValues?.isRecurring)
  );
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(defaultValues?.receiptUrl);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(defaultValues?.isRecurring ?? false);
  const [recurrenceRule, setRecurrenceRule] = useState(defaultValues?.recurrenceRule ?? "monthly");
  const [notifyByEmail, setNotifyByEmail] = useState(false);

  const { startUpload } = useUploadThing("receiptUploader");

  const handleGroupChange = (newGroupId: string) => {
    const group = groups.find((g) => g.id === newGroupId);
    if (!group) return;
    setValue("groupId", newGroupId, { shouldValidate: true });
    const allMemberIds = group.members.map((m) => m.memberId);
    setParticipantIds(allMemberIds);
    setValue("payerId", allMemberIds.includes(currentUserId) ? currentUserId : allMemberIds[0] ?? "");
    setPayerMode("single");
    setPayerAmounts({});
    setCustomSplits({});
    setSplitMethod("equal");
    setSplitError(null);
    setPayerError(null);
  };

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const equalShares = useMemo(() => {
    if (participantIds.length === 0 || validAmount <= 0) return [];
    return computeEqualSplit(validAmount, participantIds.length);
  }, [validAmount, participantIds.length]);

  const customValue = (id: string) => parseAmount(customSplits[id]) ?? 0;
  const customTotal = useMemo(
    () => participantIds.reduce((sum, id) => sum + (parseAmount(customSplits[id]) ?? 0), 0),
    [participantIds, customSplits]
  );

  const payerTotal = useMemo(
    () => sumMoney(members.map((m) => parseAmount(payerAmounts[m.memberId]) ?? 0)),
    [members, payerAmounts]
  );

  const buildSplits = (): ExpenseInput["splits"] | null => {
    if (participantIds.length === 0) {
      setSplitError("Select at least one participant");
      return null;
    }
    // Keep member order stable so the equal-split remainder lands predictably
    const ordered = members.map((m) => m.memberId).filter((id) => participantIds.includes(id));

    if (splitMethod === "equal") {
      setSplitError(null);
      const shares = computeEqualSplit(validAmount, ordered.length);
      return ordered.map((id, i) => ({ memberId: id, share: shares[i] ?? 0 }));
    }

    if (splitMethod === "percentage") {
      if (!moneyEquals(customTotal, 100)) {
        setSplitError(`Percentages must add up to 100% (currently ${customTotal.toFixed(1)}%)`);
        return null;
      }
    } else if (splitMethod === "shares") {
      if (customTotal <= 0) {
        setSplitError("Total shares must be greater than 0");
        return null;
      }
    } else if (!moneyEquals(validAmount, customTotal)) {
      setSplitError(
        `Split total (${formatCurrency(customTotal, currency)}) must equal the expense amount (${formatCurrency(validAmount, currency)})`
      );
      return null;
    }
    setSplitError(null);

    // Convert weights to money and push any rounding remainder onto the last participant
    let shares: number[];
    if (splitMethod === "percentage") {
      shares = ordered.map((id) => roundMoney((validAmount * customValue(id)) / 100));
    } else if (splitMethod === "shares") {
      shares = ordered.map((id) => roundMoney((validAmount * customValue(id)) / customTotal));
    } else {
      shares = ordered.map((id) => roundMoney(customValue(id)));
    }
    const drift = roundMoney(validAmount - sumMoney(shares));
    if (drift !== 0 && shares.length > 0) {
      shares[shares.length - 1] = roundMoney(shares[shares.length - 1] + drift);
    }
    return ordered.map((id, i) => ({ memberId: id, share: shares[i] }));
  };

  const buildPayers = (): { payers?: ExpensePayerEntry[]; payerId: string } | null => {
    if (payerMode === "single") {
      setPayerError(null);
      return { payerId };
    }
    const payers = members
      .map((m) => ({ memberId: m.memberId, amount: parseAmount(payerAmounts[m.memberId]) ?? 0 }))
      .filter((p) => p.amount > 0);
    if (payers.length === 0) {
      setPayerError("Enter how much each person paid");
      return null;
    }
    const total = sumMoney(payers.map((p) => p.amount));
    if (!moneyEquals(total, validAmount)) {
      setPayerError(
        `Payments (${formatCurrency(total, currency)}) must add up to the expense amount (${formatCurrency(validAmount, currency)})`
      );
      return null;
    }
    setPayerError(null);
    const primary = payers.reduce((a, b) => (b.amount > a.amount ? b : a));
    return { payers, payerId: primary.memberId };
  };

  const onFormSubmit = async (data: ExpenseFormValues) => {
    const splits = buildSplits();
    const paid = buildPayers();
    if (!splits || !paid) return;

    let finalReceiptUrl = receiptUrl;
    if (receiptFile) {
      setUploading(true);
      try {
        const res = await startUpload([receiptFile]);
        if (res?.[0]?.ufsUrl) finalReceiptUrl = res[0].ufsUrl;
        else toast.warning("Receipt upload failed; saving the expense without it");
      } catch {
        toast.warning("Receipt upload failed; saving the expense without it");
      } finally {
        setUploading(false);
      }
    }

    await onSubmit({
      groupId: data.groupId,
      description: data.description,
      amount: roundMoney(data.amount),
      category: category || undefined,
      splitType: splitMethod,
      payerId: paid.payerId,
      payers: paid.payers,
      expenseDate: data.expenseDate,
      notes: data.notes?.trim() || undefined,
      // Always explicit so clearing the toggle on edit actually stops the recurrence
      isRecurring,
      recurrenceRule: isRecurring ? (recurrenceRule as ExpenseInput["recurrenceRule"]) : undefined,
      receiptUrl: finalReceiptUrl,
      notifyByEmail: notifyByEmail || undefined,
      splits,
    });
  };

  const splitStatus = (ok: boolean, text: string) => (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border p-2 text-sm",
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
      )}
    >
      {text}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Group */}
      {lockGroup && selectedGroup ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          <span className="font-medium text-foreground">{selectedGroup.name}</span>
          <span>({selectedGroup.currency})</span>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="groupId">Group</Label>
          <Select value={groupId} onValueChange={handleGroupChange}>
            <SelectTrigger id="groupId" className="w-full">
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {selectableGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} ({g.currency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.groupId && <p className="text-sm text-destructive">{errors.groupId.message}</p>}
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="e.g. Dinner, Groceries, Taxi"
          autoComplete="off"
          enterKeyHint="next"
          {...register("description")}
          aria-invalid={!!errors.description}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>

      {/* Amount & Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="font-mono"
            {...register("amount", { valueAsNumber: true })}
            aria-invalid={!!errors.amount}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
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
          {errors.expenseDate && <p className="text-sm text-destructive">{errors.expenseDate.message}</p>}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category" className="w-full">
            <SelectValue placeholder="Select a category (optional)" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(CATEGORIES) as [ExpenseCategory, { emoji: string; label: string }][]).map(
              ([key, { emoji, label }]) => (
                <SelectItem key={key} value={key}>
                  {emoji} {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Who paid */}
      {groupId && members.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="payerId">Who paid</Label>
            {members.length > 1 && (
              <button
                type="button"
                className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                onClick={() => {
                  setPayerError(null);
                  setPayerMode((m) => (m === "single" ? "multiple" : "single"));
                }}
              >
                {payerMode === "single" ? "Multiple people paid" : "One person paid"}
              </button>
            )}
          </div>

          {payerMode === "single" ? (
            <>
              <Select value={payerId} onValueChange={(val) => setValue("payerId", val, { shouldValidate: true })}>
                <SelectTrigger id="payerId" className="w-full">
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
              {errors.payerId && <p className="text-sm text-destructive">{errors.payerId.message}</p>}
            </>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.memberId} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{memberName(m.memberId)}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="w-28 font-mono"
                    placeholder="0.00"
                    aria-label={`Amount paid by ${memberName(m.memberId)}`}
                    value={payerAmounts[m.memberId] ?? ""}
                    onChange={(e) =>
                      setPayerAmounts((prev) => ({ ...prev, [m.memberId]: e.target.value }))
                    }
                  />
                </div>
              ))}
              {validAmount > 0 &&
                splitStatus(
                  moneyEquals(payerTotal, validAmount),
                  moneyEquals(payerTotal, validAmount)
                    ? `Paid: ${formatCurrency(payerTotal, currency)} / ${formatCurrency(validAmount, currency)}`
                    : `Paid: ${formatCurrency(payerTotal, currency)} / ${formatCurrency(validAmount, currency)} — ${
                        validAmount - payerTotal > 0
                          ? `${formatCurrency(validAmount - payerTotal, currency)} left to assign`
                          : `${formatCurrency(payerTotal - validAmount, currency)} over`
                      }`
                )}
              {payerError && <p className="text-sm text-destructive">{payerError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Participants */}
      {groupId && members.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Split between</Label>
            <div className="flex gap-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <button type="button" className="hover:underline" onClick={() => setParticipantIds(members.map((m) => m.memberId))}>
                Everyone
              </button>
              <button type="button" className="hover:underline" onClick={() => setParticipantIds([])}>
                None
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((m) => {
              const checked = participantIds.includes(m.memberId);
              return (
                <label
                  key={m.memberId}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    checked
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleParticipant(m.memberId)} />
                  <span className="truncate">{memberName(m.memberId)}</span>
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
          <Label>How to split</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SPLIT_LABELS) as SplitType[]).map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={splitMethod === type ? "default" : "outline"}
                onClick={() => {
                  setSplitMethod(type);
                  setSplitError(null);
                }}
              >
                {SPLIT_LABELS[type]}
              </Button>
            ))}
          </div>

          {splitMethod === "equal" && validAmount > 0 && (
            <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Each person owes</p>
              <div className="flex flex-wrap gap-1.5">
                {members
                  .filter((m) => participantIds.includes(m.memberId))
                  .map((m, i) => (
                    <Badge key={m.memberId} variant="secondary" className="text-xs font-normal">
                      {memberName(m.memberId)}: {formatCurrency(equalShares[i] ?? 0, currency)}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {splitMethod !== "equal" && (
            <div className="space-y-2">
              {members
                .filter((m) => participantIds.includes(m.memberId))
                .map((m) => {
                  const id = m.memberId;
                  const suffix = splitMethod === "percentage" ? "%" : splitMethod === "shares" ? "shares" : currency;
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm">{memberName(id)}</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step={splitMethod === "shares" ? "1" : "0.01"}
                          min="0"
                          className="w-24 font-mono"
                          aria-label={`${SPLIT_LABELS[splitMethod]} for ${memberName(id)}`}
                          value={customSplits[id] ?? ""}
                          onChange={(e) => setCustomSplits((prev) => ({ ...prev, [id]: e.target.value }))}
                          placeholder="0"
                        />
                        <span className="w-12 text-xs whitespace-nowrap text-muted-foreground">{suffix}</span>
                      </div>
                    </div>
                  );
                })}

              {splitMethod === "exact" &&
                validAmount > 0 &&
                splitStatus(
                  moneyEquals(validAmount, customTotal),
                  moneyEquals(validAmount, customTotal)
                    ? `Total: ${formatCurrency(customTotal, currency)} / ${formatCurrency(validAmount, currency)}`
                    : `Total: ${formatCurrency(customTotal, currency)} / ${formatCurrency(validAmount, currency)} — ${
                        validAmount - customTotal > 0
                          ? `${formatCurrency(validAmount - customTotal, currency)} remaining`
                          : `${formatCurrency(customTotal - validAmount, currency)} over`
                      }`
                )}

              {splitMethod === "percentage" &&
                splitStatus(
                  moneyEquals(100, customTotal),
                  moneyEquals(100, customTotal)
                    ? "Total: 100%"
                    : `Total: ${customTotal.toFixed(1)}% — ${
                        100 - customTotal > 0
                          ? `${(100 - customTotal).toFixed(1)}% remaining`
                          : `${(customTotal - 100).toFixed(1)}% over`
                      }`
                )}

              {splitMethod === "shares" && customTotal > 0 && validAmount > 0 && (
                <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Preview</p>
                  <div className="flex flex-wrap gap-1.5">
                    {participantIds.map((id) => (
                      <Badge key={id} variant="secondary" className="text-xs font-normal">
                        {memberName(id)}: {formatCurrency(roundMoney((validAmount * customValue(id)) / customTotal), currency)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {splitError && <p className="text-sm text-destructive">{splitError}</p>}
            </div>
          )}
        </div>
      )}

      {/* More options */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        aria-expanded={showMore}
      >
        <span>Notes, receipt, recurring{isEditing ? "" : ", email"}</span>
        <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} />
      </button>

      {showMore && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes..."
              maxLength={240}
              rows={2}
              {...register("notes")}
              aria-invalid={!!errors.notes}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Receipt (optional)</Label>
            {receiptUrl && !receiptFile ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote receipt, size unknown */}
                <img src={receiptUrl} alt="Receipt" className="h-24 w-24 rounded-lg border object-cover" />
                <button
                  type="button"
                  aria-label="Remove receipt"
                  onClick={() => setReceiptUrl(undefined)}
                  className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : receiptFile ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={URL.createObjectURL(receiptFile)} alt="Receipt preview" className="h-24 w-24 rounded-lg border object-cover" />
                <button
                  type="button"
                  aria-label="Remove receipt"
                  onClick={() => setReceiptFile(null)}
                  className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50">
                <Upload className="size-4" />
                <span>Upload or photograph a receipt</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 4 * 1024 * 1024) {
                      toast.error("File must be under 4MB");
                      return;
                    }
                    setReceiptFile(file);
                  }}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <Checkbox checked={isRecurring} onCheckedChange={(checked) => setIsRecurring(checked === true)} />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Repeat className="size-4" />
                Repeat this expense
              </span>
            </label>
            {isRecurring && (
              <Select value={recurrenceRule} onValueChange={setRecurrenceRule}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {!isEditing && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <Checkbox checked={notifyByEmail} onCheckedChange={(checked) => setNotifyByEmail(checked === true)} />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Mail className="size-4" />
                Email group members about this expense
              </span>
            </label>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || uploading} className="w-full sm:w-auto">
          {uploading ? "Uploading..." : isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
