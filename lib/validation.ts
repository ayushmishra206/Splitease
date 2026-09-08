import { z } from "zod";
import { isValidIsoDate } from "@/lib/dates";
import { isValidMoney, moneyEquals, sumMoney } from "@/lib/money";

/**
 * Shared input schemas for server actions. Forms do their own UX validation;
 * these are the authoritative checks that run on the server.
 */

export const uuid = z.string().uuid("Invalid id");

export const moneyAmount = z
  .number({ message: "Enter an amount" })
  .refine(isValidMoney, "Amount must be a positive number with at most 2 decimals")
  .max(9_999_999_999.99, "Amount is too large");

export const isoDate = z
  .string()
  .refine(isValidIsoDate, "Enter a valid date (yyyy-MM-dd)");

export const RECURRENCE_RULES = ["weekly", "biweekly", "monthly", "yearly"] as const;
export const SPLIT_TYPES = ["equal", "percentage", "shares", "exact"] as const;

const memberAmount = z.object({ memberId: uuid, amount: moneyAmount });
const memberShare = z.object({
  memberId: uuid,
  share: z.number().min(0, "Share cannot be negative").max(9_999_999_999.99),
});

export const expenseInputSchema = z
  .object({
    groupId: uuid,
    description: z.string().trim().min(1, "Description is required").max(120),
    amount: moneyAmount,
    category: z.string().max(50).optional(),
    splitType: z.enum(SPLIT_TYPES).optional(),
    payerId: uuid,
    payers: z.array(memberAmount).max(50).optional(),
    expenseDate: isoDate,
    notes: z.string().max(240).optional(),
    isRecurring: z.boolean().optional(),
    recurrenceRule: z.enum(RECURRENCE_RULES).optional(),
    receiptUrl: z.string().url().max(2048).optional(),
    notifyByEmail: z.boolean().optional(),
    splits: z.array(memberShare).min(1, "Select at least one participant").max(50),
  })
  .superRefine((input, ctx) => {
    const splitTotal = sumMoney(input.splits.map((s) => s.share));
    if (!moneyEquals(splitTotal, input.amount)) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: `Splits (${splitTotal.toFixed(2)}) must add up to the expense amount (${input.amount.toFixed(2)})`,
      });
    }
    const splitIds = new Set(input.splits.map((s) => s.memberId));
    if (splitIds.size !== input.splits.length) {
      ctx.addIssue({ code: "custom", path: ["splits"], message: "Duplicate participant" });
    }
    if (input.payers && input.payers.length > 0) {
      const paidTotal = sumMoney(input.payers.map((p) => p.amount));
      if (!moneyEquals(paidTotal, input.amount)) {
        ctx.addIssue({
          code: "custom",
          path: ["payers"],
          message: `Payments (${paidTotal.toFixed(2)}) must add up to the expense amount (${input.amount.toFixed(2)})`,
        });
      }
      const payerIds = new Set(input.payers.map((p) => p.memberId));
      if (payerIds.size !== input.payers.length) {
        ctx.addIssue({ code: "custom", path: ["payers"], message: "Duplicate payer" });
      }
    }
    if (input.isRecurring && !input.recurrenceRule) {
      ctx.addIssue({
        code: "custom",
        path: ["recurrenceRule"],
        message: "Choose how often this expense repeats",
      });
    }
  });

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const settlementInputSchema = z
  .object({
    groupId: uuid,
    fromMember: uuid,
    toMember: uuid,
    amount: moneyAmount,
    settlementDate: isoDate,
    notes: z.string().max(240).optional(),
  })
  .refine((s) => s.fromMember !== s.toMember, {
    path: ["toMember"],
    message: "Payer and receiver must be different",
  });

export type SettlementInput = z.infer<typeof settlementInputSchema>;

/** Turn a zod error into a single human-readable message for toasts. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Parse or throw an Error with a readable message (server actions surface `Error.message`). */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(firstIssueMessage(result.error));
  return result.data;
}
