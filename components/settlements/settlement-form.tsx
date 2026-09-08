"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users } from "lucide-react";
import { todayIso } from "@/lib/dates";
import { isValidMoney, roundMoney } from "@/lib/money";
import { displayName } from "@/lib/utils";
import type { SettlementInput } from "@/lib/validation";
import type { GroupWithMembers } from "@/lib/types";
import { isArchived } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z
  .object({
    groupId: z.string().min(1, "Select a group"),
    fromMember: z.string().min(1, "Select who paid"),
    toMember: z.string().min(1, "Select who received the payment"),
    amount: z
      .number({ message: "Enter an amount" })
      .positive("Amount must be greater than 0")
      .refine(isValidMoney, "Use at most 2 decimal places"),
    settlementDate: z.string().min(1, "Select a date"),
    notes: z.string().max(240, "Keep notes under 240 characters").optional(),
  })
  .refine((v) => v.fromMember !== v.toMember, {
    path: ["toMember"],
    message: "Payer and receiver must be different",
  });

type FormValues = z.infer<typeof schema>;

interface SettlementFormProps {
  groups: GroupWithMembers[];
  currentUserId: string;
  /** Hide the group picker (the form is used inside one group). */
  lockGroup?: boolean;
  defaultValues?: Partial<SettlementInput>;
  onSubmit: (data: SettlementInput) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function SettlementForm({
  groups,
  currentUserId,
  lockGroup = false,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Record settlement",
}: SettlementFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!defaultValues?.fromMember && !!defaultValues?.toMember && defaultValues.amount !== undefined;

  const selectableGroups = useMemo(
    () => groups.filter((g) => !isArchived(g) || g.id === defaultValues?.groupId),
    [groups, defaultValues?.groupId]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      groupId: defaultValues?.groupId ?? (selectableGroups.length === 1 ? selectableGroups[0].id : ""),
      fromMember: defaultValues?.fromMember ?? currentUserId,
      toMember: defaultValues?.toMember ?? "",
      amount: defaultValues?.amount,
      settlementDate: defaultValues?.settlementDate ?? todayIso(),
      notes: defaultValues?.notes ?? "",
    },
  });

  const selectedGroupId = form.watch("groupId");
  const fromMember = form.watch("fromMember");
  const toMember = form.watch("toMember");

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId]
  );
  const members = selectedGroup?.members ?? [];
  const memberLabel = (memberId: string) =>
    displayName(members.find((m) => m.memberId === memberId)?.member, currentUserId);

  const handleSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await onSubmit({
        groupId: data.groupId,
        fromMember: data.fromMember,
        toMember: data.toMember,
        amount: roundMoney(data.amount),
        settlementDate: data.settlementDate,
        notes: data.notes?.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const errors = form.formState.errors;
  const showGroupPicker = !lockGroup && selectableGroups.length > 1;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      {showGroupPicker ? (
        <div className="space-y-2">
          <Label htmlFor="settlement-group">Group</Label>
          <Select
            value={selectedGroupId}
            onValueChange={(v) => {
              form.setValue("groupId", v, { shouldValidate: true });
              form.setValue("fromMember", currentUserId);
              form.setValue("toMember", "");
            }}
          >
            <SelectTrigger id="settlement-group" className="w-full">
              <SelectValue placeholder="Select group" />
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
      ) : selectedGroup ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          <span className="font-medium text-foreground">{selectedGroup.name}</span>
          <span>({selectedGroup.currency})</span>
        </div>
      ) : null}

      {selectedGroup && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="settlement-from">Who paid</Label>
            <Select
              value={fromMember}
              onValueChange={(v) => {
                form.setValue("fromMember", v, { shouldValidate: true });
                if (v === toMember) form.setValue("toMember", "");
              }}
            >
              <SelectTrigger id="settlement-from" className="w-full">
                <SelectValue placeholder="Payer" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.memberId} value={m.memberId}>
                    {memberLabel(m.memberId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.fromMember && <p className="text-sm text-destructive">{errors.fromMember.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="settlement-to">Who received</Label>
            <Select value={toMember} onValueChange={(v) => form.setValue("toMember", v, { shouldValidate: true })}>
              <SelectTrigger id="settlement-to" className="w-full">
                <SelectValue placeholder="Receiver" />
              </SelectTrigger>
              <SelectContent>
                {members
                  .filter((m) => m.memberId !== fromMember)
                  .map((m) => (
                    <SelectItem key={m.memberId} value={m.memberId}>
                      {memberLabel(m.memberId)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.toMember && <p className="text-sm text-destructive">{errors.toMember.message}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="settlement-amount">Amount{selectedGroup ? ` (${selectedGroup.currency})` : ""}</Label>
          <Input
            id="settlement-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="font-mono"
            {...form.register("amount", { valueAsNumber: true })}
            aria-invalid={!!errors.amount}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="settlement-date">Date</Label>
          <Input
            id="settlement-date"
            type="date"
            max={todayIso()}
            {...form.register("settlementDate")}
            aria-invalid={!!errors.settlementDate}
          />
          {errors.settlementDate && <p className="text-sm text-destructive">{errors.settlementDate.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="settlement-notes">Notes (optional)</Label>
        <Textarea
          id="settlement-notes"
          rows={2}
          maxLength={240}
          placeholder="e.g. Cash, bank transfer, UPI"
          {...form.register("notes")}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? "Saving..." : isEditing ? submitLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
