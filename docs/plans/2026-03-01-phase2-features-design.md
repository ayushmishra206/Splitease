# SplitEase Phase 2 Features — Design Document

**Date:** 2026-03-01
**Status:** Approved

**Goal:** Add 10 features to complete the SplitEase MVP: quick add modal, currency fix, group archive, settle-up flow, analytics dashboard, receipt uploads, recurring expenses, pagination, push notifications, and a test suite.

**Tech Stack:** Next.js 16, React 19, Prisma + Neon PostgreSQL, NextAuth v5, Tailwind CSS v4, shadcn/ui, Vitest, Recharts, Uploadthing, web-push.

---

## 1. Quick Add Expense Modal

**Problem:** Adding an expense requires navigating to the expenses page. Users want to add expenses from anywhere.

**Solution:**
- Global `QuickAddExpenseProvider` context in the dashboard layout, exposing `openQuickAdd()`.
- Floating action button (FAB) — circular emerald button with `+` icon, bottom-right corner on all pages. Positioned above mobile nav on small screens.
- Opens a Dialog containing the existing `ExpenseForm`.
- Keyboard shortcut: not needed for MVP (FAB is sufficient).

**Files:** New `components/quick-add-expense.tsx`, modify `app/(dashboard)/layout.tsx`.

---

## 2. Currency Fix in Expense Modal

**Problem:** The expense form shows hardcoded "USD" next to the amount, regardless of the selected group's currency.

**Solution:**
- When a group is selected in the expense form, look up that group's `currency` field from the `groups` prop.
- Pass it to the amount display instead of hardcoded "USD".
- Pure prop threading — no new components or state.

**Files:** Modify `components/expenses/expense-form.tsx`.

---

## 3. Group Archive / Settle & Close

**Problem:** Groups can only be deleted. Users want to mark groups as "done" without losing data.

**Schema change:**
- Add `status String @default("active") @db.VarChar(20)` to Group model (values: `"active"`, `"archived"`).

**Behavior:**
- "Archive Group" button on group detail page (owner only).
- Enabled only when all balances are zero (fully settled).
- If balances exist, button text becomes "Settle & Archive" — prompts user to settle debts first.
- Archived groups appear in a separate "Archived" section on the groups page, visually muted.
- Archived groups are read-only: no new expenses or settlements.
- Owner can "Restore" an archived group back to active.

**Files:** Modify `prisma/schema.prisma`, `actions/groups.ts`, `components/groups/group-list.tsx`, `components/groups/group-detail-client.tsx`.

---

## 4. Settle-Up Flow

**Problem:** The balances tab shows suggested settlements but there's no way to record a payment from within a group.

**Solution:**
- "Settle Up" button next to each suggested settlement on the balances tab.
- Clicking opens a Dialog pre-filled with from, to, and amount from the suggestion.
- User can adjust amount for partial settlements.
- On submit: `createSettlement()` → email notification → refresh balances.
- General "Settle Up" button at top of balances tab for manual (non-suggested) settlements.
- When all balances hit zero after settling, show celebratory state + offer to archive.

**Files:** Modify `components/groups/group-detail-client.tsx`, reuse existing `SettlementForm` or inline a simplified form.

---

## 5. Analytics Dashboard

**Problem:** No spending insights or visualizations.

**Solution:** New page at `/analytics` with nav item.

**Sections:**
1. **Spending over time** — Bar chart, total expenses per month (last 6 months).
2. **Category breakdown** — Donut chart of spending by category.
3. **Group comparison** — Horizontal bar chart comparing spending across groups.
4. **Top spenders** — Ranked list of who paid the most.

**Library:** `recharts` (lightweight, React-native, SSR-compatible).

**Data:** New `fetchAnalyticsData()` server action. All aggregation server-side via Prisma groupBy queries.

**Filters:** Group filter dropdown and date range picker at top.

**Files:** New `app/(dashboard)/analytics/page.tsx`, new `components/analytics/analytics-client.tsx`, new `actions/analytics.ts`, modify nav components.

---

## 6. Receipt Image Upload

**Problem:** No way to attach receipt photos to expenses.

**Schema change:**
- Add `receiptUrl String?` to Expense model.

**Storage:** Uploadthing (free tier, 2GB, simple React SDK).

**Behavior:**
- Upload zone in expense form below notes field — click or drag-and-drop.
- Accept images only (JPEG, PNG, WebP), max 5MB.
- Client uploads directly to Uploadthing, receives URL.
- Thumbnail preview after upload with remove button.
- On expense cards/detail, show receipt thumbnail with click-to-expand lightbox.

**Files:** New `lib/uploadthing.ts` (config), new `app/api/uploadthing/route.ts`, modify `components/expenses/expense-form.tsx`, modify `prisma/schema.prisma`, modify `actions/expenses.ts`.

---

## 7. Recurring Expenses

**Problem:** Regular expenses (rent, subscriptions) must be manually re-entered.

**Schema changes on Expense model:**
- `isRecurring Boolean @default(false)`
- `recurrenceRule String? @db.VarChar(50)` — values: `"weekly"`, `"biweekly"`, `"monthly"`, `"yearly"`
- `nextOccurrence DateTime?`

**Behavior:**
- Toggle "Make this recurring" in expense form → reveals frequency dropdown.
- API route `/api/cron/recurring-expenses` (hit daily by Vercel Cron):
  1. Query expenses where `isRecurring = true` AND `nextOccurrence <= now`.
  2. Duplicate expense (same group, payer, splits, category, amount).
  3. Update `nextOccurrence` based on recurrence rule.
  4. Send notification emails.
- Recurring expenses show a repeat icon badge in expense lists.
- Owner can stop recurrence from expense edit form.

**Files:** Modify `prisma/schema.prisma`, modify `components/expenses/expense-form.tsx`, new `app/api/cron/recurring-expenses/route.ts`, modify `actions/expenses.ts`.

---

## 8. Pagination

**Problem:** Expense and settlement lists load all records. Will slow down with growth.

**Solution:** Cursor-based pagination using `createdAt`.

**Pattern:**
- Server actions accept `cursor?: string` and `limit?: number` (default 20).
- Return `{ items, nextCursor: string | null }`.
- Client accumulates items in state, shows "Load more" button when `nextCursor` exists.

**Applied to:**
- Expenses page (`fetchExpenses`)
- Group detail expenses tab
- Settlements list

**Files:** Modify `actions/expenses.ts`, `actions/settlements.ts`, `actions/group-detail.ts`, `components/expenses/expense-list.tsx`, `components/groups/group-detail-client.tsx`.

---

## 9. Push Notifications

**Problem:** Users only get email notifications, which are slow and easily missed.

**Solution:** Browser push notifications via Web Push API.

**Architecture:**
- `PushSubscription` model: `userId`, `endpoint`, `p256dh`, `auth`, `createdAt`.
- On login, prompt for notification permission. Store subscription via server action.
- `web-push` npm package for server-side push sending.
- Service worker `public/sw.js` handles push events, shows native notification.
- Click notification opens relevant group page.

**Triggers:** Same as email — expense created, settlement recorded, group invite.

**Settings:** Toggle in settings page to enable/disable. Email continues regardless (push is additive).

**Files:** New `public/sw.js`, modify `prisma/schema.prisma`, new `lib/push.ts`, new `actions/push.ts`, modify `actions/expenses.ts` and `actions/settlements.ts`, modify settings page.

---

## 10. Test Suite

**Problem:** Zero test coverage.

**Framework:** Vitest + React Testing Library.

**Scope:**
- **Unit tests:** `lib/simplify-debts.ts`, `lib/utils.ts`, `lib/categories.ts` — pure function tests.
- **Server action tests:** Mock Prisma client, test validation logic, authorization checks, and data flow in `createExpense`, `createSettlement`, `createGroup`, `signUp`.
- **Component tests:** `ExpenseForm` (split calculations, validation), `GroupForm`, `SettlementForm`.

**Not in scope:** E2E tests, visual regression.

**Config:** `vitest.config.ts` with path aliases matching `tsconfig.json`.

**Target:** ~40-50 tests covering critical business logic.

**Files:** New `vitest.config.ts`, new `__tests__/` directory with test files, modify `package.json` (test script).

---

## Implementation Order

1. Schema changes (status, receiptUrl, recurring fields, PushSubscription model)
2. Currency fix (trivial, immediate win)
3. Quick add expense modal
4. Settle-up flow
5. Group archive
6. Pagination
7. Analytics dashboard
8. Receipt image upload (Uploadthing)
9. Recurring expenses
10. Push notifications
11. Test suite
12. Cleanup (remove supabase devDep, update README)
