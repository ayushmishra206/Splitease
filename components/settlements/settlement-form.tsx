"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

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

const schema = z.object({
  groupId: z.string().min(1, "Select a group"),
  fromMember: z.string().min(1, "Select who is paying"),
  toMember: z.string().min(1, "Select who is receiving"),
  amount: z.number().positive("Amount must be positive"),
  settlementDate: z.string().min(1, "Select a date"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type GroupWithMembers = {
  id: string;
  name: string;
  currency: string;
  members: Array<{
    memberId: string;
    member: { id: string; fullName: string | null };
  }>;
};

interface SettlementFormProps {
  groups: GroupWithMembers[];
  currentUserId: string;
  defaultValues?: Partial<FormValues>;
  onSubmit: (data: FormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function SettlementForm({
  groups,
  currentUserId,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Record Settlement",
}: SettlementFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      groupId: defaultValues?.groupId ?? (groups.length === 1 ? groups[0].id : ""),
      fromMember: defaultValues?.fromMember ?? currentUserId,
      toMember: defaultValues?.toMember ?? "",
      amount: defaultValues?.amount ?? 0,
      settlementDate: defaultValues?.settlementDate ?? format(new Date(), "yyyy-MM-dd"),
      notes: defaultValues?.notes ?? "",
    },
  });

  const selectedGroupId = form.watch("groupId");
  const fromMember = form.watch("fromMember");

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId]
  );

  const members = selectedGroup?.members ?? [];

  const handleSubmit = async (data: FormValues) => {
    if (data.fromMember === data.toMember) {
      form.setError("toMember", { message: "Payer and receiver must be different" });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      {/* Group */}
      <div className="space-y-2">
        <Label>Group</Label>
        <Select
          value={selectedGroupId}
          onValueChange={(v) => {
            form.setValue("groupId", v);
            form.setValue("fromMember", currentUserId);
            form.setValue("toMember", "");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name} ({g.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.groupId && (
          <p className="text-sm text-destructive">{form.formState.errors.groupId.message}</p>
        )}
      </div>

      {/* From / To */}
      {selectedGroup && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From (Payer)</Label>
            <Select
              value={fromMember}
              onValueChange={(v) => form.setValue("fromMember", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Who paid" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.memberId} value={m.memberId}>
                    {m.memberId === currentUserId ? "You" : m.member.fullName ?? "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.fromMember && (
              <p className="text-sm text-destructive">{form.formState.errors.fromMember.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>To (Receiver)</Label>
            <Select
              value={form.watch("toMember")}
              onValueChange={(v) => form.setValue("toMember", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Who received" />
              </SelectTrigger>
              <SelectContent>
                {members
                  .filter((m) => m.memberId !== fromMember)
                  .map((m) => (
                    <SelectItem key={m.memberId} value={m.memberId}>
                      {m.memberId === currentUserId ? "You" : m.member.fullName ?? "Unknown"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {form.formState.errors.toMember && (
              <p className="text-sm text-destructive">{form.formState.errors.toMember.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Amount + Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            {...form.register("amount")}
          />
          {form.formState.errors.amount && (
            <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" {...form.register("settlementDate")} />
          {form.formState.errors.settlementDate && (
            <p className="text-sm text-destructive">{form.formState.errors.settlementDate.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea rows={2} placeholder="Add a note..." {...form.register("notes")} />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
