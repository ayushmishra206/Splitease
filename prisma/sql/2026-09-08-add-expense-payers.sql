-- Adds the `expense_payers` table introduced with multi-payer expenses (PR #3).
--
-- Without this table every page that reads expenses (dashboard, expenses,
-- groups, group detail, analytics) fails with Prisma error P2021:
--   The table `public.expense_payers` does not exist in the current database.
--
-- Safe to run more than once. No backfill is required: expenses with no rows
-- here are treated as paid in full by `expenses.payer_id`.

CREATE TABLE IF NOT EXISTS "expense_payers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "expense_payers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "expense_payers_member_id_idx" ON "expense_payers"("member_id");

CREATE UNIQUE INDEX IF NOT EXISTS "expense_payers_expense_id_member_id_key"
    ON "expense_payers"("expense_id", "member_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expense_payers_expense_id_fkey'
    ) THEN
        ALTER TABLE "expense_payers"
            ADD CONSTRAINT "expense_payers_expense_id_fkey"
            FOREIGN KEY ("expense_id") REFERENCES "expenses"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expense_payers_member_id_fkey'
    ) THEN
        ALTER TABLE "expense_payers"
            ADD CONSTRAINT "expense_payers_member_id_fkey"
            FOREIGN KEY ("member_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
