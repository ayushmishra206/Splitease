# SplitEase code, feature and UI audit — 8 September 2026

Scope: the whole application as of commit `7f20d39` on `main` — server actions,
Prisma schema, auth, notifications, backup, cron, every page and component, the
PWA shell, and the test suite. Everything marked **Fixed** in this document is
implemented on branch `claude/audit-mobile-optimization-1md0pt`; items under
"Nice-to-have backlog" are not implemented and are listed for prioritisation.

Verification at the end of the work: `tsc --noEmit` clean, `eslint` 0 errors
(1 pre-existing warning from react-hook-form), `vitest` 158 tests passing,
`next build` succeeds.

---

## 1. Requested items

| Request | Status | Where |
| --- | --- | --- |
| Show total spent for a group | **Done** | Group page summary strip (total spent, your share, you paid, your balance); group cards on the dashboard and the groups list; analytics header tiles |
| Settlement not saved from the Settlements page form | **Fixed** | `components/settlements/settlement-form.tsx` |
| "Add Expense" navigates but does not open the form | **Fixed** | `components/quick-add-expense.tsx`, header, mobile nav, group page |
| Type errors when entering amounts | **Fixed** | Both forms, `lib/money.ts`, `lib/validation.ts`, all server actions |
| Nice-to-have enhancements | **Audited**, several implemented | Section 5 and 6 |
| Mobile-first optimisation | **Done** | Section 4 |
| Any member can edit an expense they did not add (follow-up request) | **Done** | `actions/expenses.ts` `updateExpense`, both edit UIs |
| Multiple payers per expense, Splitwise-style (follow-up request) | **Done** | New `ExpensePayer` table, form, balances, analytics, backup, cron |

Assumptions made on the follow-up requests:

- "Suggest edits" is implemented as a **direct edit by any group member**, the
  way Splitwise works, rather than a propose/approve workflow. The original
  author is notified by push, and the activity log records who edited whose
  expense. A review queue would need a new table and UI and is listed in the
  backlog if you want it.
- Deleting stays restricted to the person who added the expense, anyone who
  paid part of it, or the group owner.

---

## 2. Root causes of the reported bugs

### 2.1 Settlement form on the Settlements page never saved

`SettlementForm` registered the amount input without `valueAsNumber`, so
react-hook-form handed zod a **string**. The schema required `z.number()`, so
validation failed on every submit. The default amount was `0`, which also
failed the `positive()` rule when editing. The group page had its own hand-rolled
settle dialog that parsed the amount manually, which is why settlements only
worked from there.

Fix: numeric registration, `undefined` default, a shared `SettlementInput`
type, a single `SettlementForm` reused by the Settlements page and the group
page, and server-side validation that rejects string amounts (covered by a test).

### 2.2 "Add Expense" opened nothing

Every entry point linked to `/expenses?create=true`. The expenses page opened
its dialog from a `useEffect` on `searchParams`, which has three failure modes:

1. Once the dialog was closed the URL still had `?create=true`; clicking "Add"
   again produced no change in `searchParams`, so the effect did not re-run.
2. After a successful create the page called `router.refresh()`, which can
   re-run the effect and **re-open** the dialog.
3. The group page passed `&group=<id>` but nothing read it, so the group was
   never pre-selected.

Fix: a single app-wide `QuickAddProvider` (React context) renders one "Add
expense" sheet. The header button, the mobile nav centre button, the group page
and empty states all call `open({ groupId })` and the sheet opens in place, on
any page, with no navigation. `/expenses?create=true` still works for deep links;
it opens the sheet once and then removes the query with `router.replace`.

### 2.3 Amount type errors

- `ExpenseForm` seeded `amount` with `undefined as unknown as number` and cast
  the resolver to `any`, hiding a zod v4 / resolver mismatch.
- Empty inputs became `NaN` and produced the raw zod message "expected number,
  received NaN".
- Server actions accepted `amount: number` on trust; a string, `NaN` or
  negative value went straight to Prisma and surfaced as a generic
  "Failed to create expense".
- List components typed Prisma `Decimal` fields as `unknown` and parsed them
  ad hoc with `parseFloat(String(x))` in eleven places.

Fix: `lib/money.ts` (`parseAmount`, `roundMoney`, `sumMoney`, `isValidMoney`,
`toNumber`), `lib/validation.ts` zod schemas used by **every** expense and
settlement action (`parseOrThrow` returns readable messages that the UI now
shows in toasts), numeric inputs with `inputMode="decimal"`, and strongly typed
serialisers (`ExpenseWithDetails`, `SettlementWithDetails`) so the client never
sees a `Decimal`.

---

## 3. Other defects found during the audit

Severity: **H** = data or money is wrong, **M** = feature broken, **L** = polish.

| # | Sev | Finding | Status |
| --- | --- | --- | --- |
| 1 | H | Activity log was never written: `void prisma.activityLog.create(...)` never executes because Prisma queries are lazy until awaited. The Activity tab silently fell back to deriving history from expenses. | Fixed: awaited, and wrapped in transactions with deletes |
| 2 | H | Backup export and import were incompatible: export produced a name-only document with no `version` or ids, import required `version: 1` with ids. Every restore failed with "Unsupported backup version". | Fixed: version 2 format with ids and names, imports v1 and v2, validates with zod, skips members that no longer exist, restores payers |
| 3 | H | `updateSettlement` trusted `input.groupId`; a member of any group could rewrite a settlement from another group by id. | Fixed: settlement's own group is authoritative, moving between groups is rejected |
| 4 | H | `updateExpense` accepted a new `groupId`, allowing an expense to be moved into a group the editor is not a member of. | Fixed: moves rejected |
| 5 | H | Dates displayed a day early for users west of UTC. Prisma returns `@db.Date` as UTC midnight; `format(new Date(d))` used local time. Affected expense cards, group day headers, settlement cards, dashboard, edit forms, and the "today" default which used `toISOString()`. | Fixed: `lib/dates.ts` (`formatDateOnly`, `dateOnlyKey`, `todayIso`) used everywhere |
| 6 | H | Removing a member left their splits and debts behind, and the group page then showed "Unknown" in balances. | Fixed: removal blocked while the member has a non-zero balance; new "Leave group" action with the same guard |
| 7 | M | Editing a non-equal expense set `splitMethod: "custom"`, a value the form does not know, so no split method was highlighted and no inputs rendered. | Fixed: edits restore as "exact amounts" with the stored shares (percent and share weights are not persisted) |
| 8 | M | Archived groups still accepted expenses and settlements through the server actions (the UI only hid buttons). | Fixed: server rejects writes to archived groups |
| 9 | M | Payers and participants were not checked against group membership on the server. | Fixed |
| 10 | M | Analytics is unreachable on phones: it is not in the bottom nav or the mobile account menu. | Fixed: added to the account menu |
| 11 | M | Bottom nav is hidden from `md` but the content padding switched at `sm`, so on tablets between 640 and 768 px the nav covered the last card. | Fixed |
| 12 | M | `viewport-fit=cover` was never set, so `env(safe-area-inset-bottom)` was always 0 and the bottom nav sat under the iPhone home indicator in the installed PWA. | Fixed: `viewport` export in the root layout |
| 13 | M | Recurring expenses were dated when the cron ran, not on the scheduled day, lost their creator, and ran for archived groups. | Fixed |
| 14 | M | `Resend` client was constructed at import time and threw without `RESEND_API_KEY`, breaking `next build` and local development without email. | Fixed: lazy client |
| 15 | M | Import/export/toast paths swallowed error messages ("Failed to …"), so users could not see *why* (e.g. the balance guard). | Fixed: server messages are surfaced |
| 16 | L | Mobile header dropdown used a hand-rolled overlay inside a `z-10` header, so the bottom nav (`z-20`) stayed clickable while the menu was open and there was no keyboard/escape handling. | Fixed: Radix `DropdownMenu` |
| 17 | L | `setState` inside `useEffect` for the "mounted" flag in the sidebar and theme toggle (React Compiler lint errors). | Fixed: `useSyncExternalStore`-based `useMounted` |
| 18 | L | Sidebar collapse state reset on every navigation. | Fixed: persisted in localStorage |
| 19 | L | Recharts tooltip used `hsl(var(--card))` but the theme tokens are hex, giving an invalid colour. | Fixed |
| 20 | L | `computeEqualSplit` mixed float maths with a cents remainder (`Math.floor((total*100)/count)/100`) and could drift; rewritten in integer cents with a property test. | Fixed |
| 21 | L | `searchProfiles` was callable without a session and only matched on name. | Fixed: requires auth, also matches an exact email |
| 22 | L | Group create/update did no server validation of name length or currency code. | Fixed |
| 23 | L | Expense list "Load more" could duplicate rows on cursor ties. | Fixed: de-duplicated by id |

---

## 4. Mobile-first changes

The app is used mostly on phones, so the shell was reworked around that:

- **Bottom-sheet dialogs.** `DialogContent` is a full-width sheet anchored to the
  bottom on screens under 640 px, with a drag handle, internal scrolling,
  `overscroll-contain`, and safe-area padding. On tablets and desktops it is the
  familiar centred modal.
- **One "Add expense" sheet everywhere.** The centre button of the bottom nav
  opens it in place; no page navigation, no lost scroll position.
- **Shorter expense form.** Notes, receipt, recurring and email opt-in live
  behind a "more options" toggle. Buttons are full-width and stacked on phones.
  Amount inputs use the decimal keypad, the receipt picker can open the camera
  (`capture="environment"`), participant chips are 44 px tall.
- **Group page.** Compact header (back, name, tap-to-see members, primary "Add"
  button, overflow menu for invite/members/archive/leave), a 2×2 summary strip
  with total spent, your share, you paid and your balance; tapping an expense
  opens a detail sheet with edit and delete.
- **Expenses page.** Filters collapse behind a toggle on phones; the search box
  uses `type="search"`. The page FAB was removed because the nav's centre button
  does the same job (a FAB remains on Groups and Settlements, where the primary
  action is different).
- **Dashboard.** Balance cards are 2-up on phones with the net balance spanning
  the row; group cards show total spent and your share.
- **Safe areas.** `viewport-fit=cover`, nav and FABs offset by
  `env(safe-area-inset-bottom)`, `min-h-dvh` instead of `min-h-screen` so the
  iOS URL bar does not cause overflow.
- **Toasts** moved to top-centre with a close button (top-right is off-screen
  on narrow viewports).
- **Header** titles shrink on phones; the mobile account menu gains Analytics.
- Theme colour meta for light and dark so the status bar matches the app.

---

## 5. Features added

- **Total spent per group** (requested) — everywhere a group is summarised.
- **Multiple payers per expense** (requested) — "Multiple people paid" toggle in
  the form with a running total; balances, top spenders, backup and recurring
  copies all understand it. Existing rows keep working: an expense without payer
  rows is treated as fully paid by its `payerId`. The largest contributor is
  stored in `payerId` for compatibility.
- **Any member can edit any expense** (requested) — with notification of the
  original author and an activity entry.
- **Expense detail sheet** on the group page with your lent/borrowed position.
- **Net balances for every member** and a list of recorded payments on the
  Balances tab.
- **Leave group** for non-owners, guarded by a settled balance.
- **Restorable backups** (version 2) that are still readable.
- **Search members by exact email** in the member manager.
- **Analytics totals** (total spent, your share, expense count) and a group
  filter that fits phone widths.

---

## 6. Nice-to-have backlog (not implemented)

Ordered by expected value for a mobile-first expense app.

1. **Offline-first / optimistic updates.** Every mutation waits for the server
   and then `router.refresh()`. On a slow connection the sheet stays open for a
   second or two. Optimistic inserts into the lists with rollback on error would
   make the app feel instant.
2. **Proposed-edit review queue.** If "suggest edits" should mean approval by
   the author, add an `ExpenseEditProposal` table, a badge on the expense, and
   accept/reject actions. The current direct-edit path is the foundation.
3. **Per-currency totals on the dashboard.** Cross-currency sums are currently
   added as-is in the most common currency (now flagged in the UI). Either show
   one row per currency or add exchange rates.
4. **Itemised receipts / OCR.** Photograph a receipt and pre-fill description
   and amount.
5. **Comments on expenses** for "why is this $40?" conversations.
6. **Invite by link that actually joins.** The copied link opens the group page
   but there is no join flow; members are still added by search. A signed invite
   token with a join page would remove the friction of finding people by name.
7. **Payment deep links** (UPI, Venmo, PayPal.me) on suggested settlements.
8. **Push notification preferences** per event type; today it is all or nothing.
9. **Unit tests for components.** The suite covers libraries and actions.
   Adding React Testing Library for the two forms would lock in the amount and
   multi-payer behaviours.
10. **E2E smoke test** with Playwright against a seeded Postgres (Neon branch
    or Docker) for the create → settle → archive path.
11. **Percent and share weights persisted** so those split modes can be edited
    in their original form rather than as exact amounts.
12. **Manifest polish**: 512 px and maskable icons, screenshots, and
    `theme_color` aligned with the design tokens.
13. **Rate limiting / abuse protection** on `searchProfiles` and the auth
    endpoints (the password reset flow already has it).
14. **Accessibility pass** with a screen reader: most controls now have labels,
    but the tab bar on the group page should become a Radix `Tabs` for arrow-key
    navigation.

---

## 7. Data migration

The only schema change is the new additive table `expense_payers`
(`ExpensePayer` model). Run:

```bash
npx prisma generate
npx prisma db push
```

No backfill is required: the code treats expenses without payer rows as paid in
full by `payerId`. If you prefer explicit rows for historical data:

```sql
INSERT INTO expense_payers (id, expense_id, member_id, amount)
SELECT gen_random_uuid(), e.id, e.payer_id, e.amount
FROM expenses e
WHERE e.payer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM expense_payers p WHERE p.expense_id = e.id);
```

---

## 8. Files touched

- Schema: `prisma/schema.prisma`
- New libraries: `lib/money.ts`, `lib/dates.ts`, `lib/validation.ts`,
  `lib/expenses-shared.ts`, `lib/types.ts`, `lib/hooks/use-mounted.ts`
- Updated libraries: `lib/utils.ts`, `lib/simplify-debts.ts`, `lib/resend.ts`,
  `lib/email/send.ts`
- Server actions: `actions/expenses.ts`, `actions/settlements.ts`,
  `actions/groups.ts`, `actions/group-detail.ts`, `actions/dashboard.ts`,
  `actions/analytics.ts`, `actions/backup.ts`,
  `app/api/cron/recurring-expenses/route.ts`
- Shell: `app/layout.tsx`, `app/(dashboard)/layout.tsx`,
  `components/layout/*`, `components/ui/dialog.tsx`,
  `components/quick-add-expense.tsx`
- Features: `components/expenses/*`, `components/settlements/*`,
  `components/groups/*`, `components/dashboard/dashboard-client.tsx`,
  `components/analytics/analytics-client.tsx`,
  `components/settings/settings-client.tsx`, `app/(dashboard)/groups/page.tsx`
- Tests: `__tests__/lib/{money,dates,validation,expenses-shared}.test.ts`,
  `__tests__/actions/expenses.test.ts`, extended `simplify-debts` and `utils`
