"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

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

const groupSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(240).optional(),
  currency: z.string().min(3).max(3),
});

type GroupFormValues = z.infer<typeof groupSchema>;

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"] as const;

interface GroupFormProps {
  onSubmit: (data: GroupFormValues) => Promise<void>;
  onCancel?: () => void;
  defaultValues?: { name?: string; description?: string; currency?: string };
  additionalContent?: React.ReactNode;
  submitLabel?: string;
}

export function GroupForm({
  onSubmit,
  onCancel,
  defaultValues,
  additionalContent,
  submitLabel = "Save",
}: GroupFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      currency: defaultValues?.currency ?? "USD",
    },
  });

  const currency = watch("currency");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="e.g. Weekend Trip"
          {...register("name")}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Optional description"
          {...register("description")}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Select
          value={currency}
          onValueChange={(value) => setValue("currency", value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.currency && (
          <p className="text-sm text-destructive">{errors.currency.message}</p>
        )}
      </div>

      {additionalContent}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
