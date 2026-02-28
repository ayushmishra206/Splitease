# SplitEase Phase 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 10 features to complete SplitEase: quick-add modal, currency fix, group archive, settle-up flow, analytics dashboard, receipt uploads, recurring expenses, pagination, push notifications, and test suite.

**Architecture:** Server actions (Next.js "use server") handle all mutations. Client components use Dialog pattern for modals. Prisma ORM talks to Neon PostgreSQL. Uploadthing for receipt storage. Recharts for analytics. Vitest for testing.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma + Neon PostgreSQL, NextAuth v5, Tailwind CSS v4, shadcn/ui, Recharts, Uploadthing, web-push, Vitest.

---

### Task 1: Schema Changes

All Prisma schema changes in a single migration to avoid multiple `db push` cycles.

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add all new fields and models**

Open `prisma/schema.prisma` and make these changes:

1. Add `status` to `Group` model (after `currency` line):
```prisma
status    String   @default("active") @db.VarChar(20)
```

2. Add `receiptUrl` and recurring fields to `Expense` model (after `notes` line):
```prisma
receiptUrl      String?  @map("receipt_url")
isRecurring     Boolean  @default(false) @map("is_recurring")
recurrenceRule  String?  @map("recurrence_rule") @db.VarChar(50)
nextOccurrence  DateTime? @map("next_occurrence") @db.Timestamptz(6)
```

3. Add new `PushSubscription` model (after `PasswordResetToken` model):
```prisma
model PushSubscription {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  endpoint  String
  p256dh    String
  auth      String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, endpoint])
  @@index([userId])
  @@map("push_subscriptions")
}
```

4. Add the relation to `User` model (after `resetTokens` line):
```prisma
pushSubscriptions PushSubscription[]
```

**Step 2: Push schema to Neon**

Run:
```bash
npx prisma db push
```
Expected: Schema pushed successfully, no errors.

**Step 3: Generate client**

Run:
```bash
npx prisma generate
```
Expected: Prisma Client generated.

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add schema fields for archive, receipts, recurring, push subscriptions"
```

---

### Task 2: Currency Fix in Expense Form

The expense form currently shows "USD" hardcoded. It should show the selected group's currency.

**Files:**
- Modify: `components/expenses/expense-form.tsx`

**Step 1: Verify current behavior**

Read `components/expenses/expense-form.tsx`. The currency is already computed on line 148:
```typescript
const currency = selectedGroup?.currency ?? "USD";
```
And it's already used in the Label on line 357:
```tsx
<Label htmlFor="amount">Amount ({currency})</Label>
```

**The currency already dynamically changes based on group selection.** Verify this is working. If it is, this task is already done. The only hardcoded "USD" is the fallback when no group is selected, which is correct behavior.

**Step 2: Verify and commit (only if changes needed)**

If already working, skip this task. No commit needed.

---

### Task 3: Quick Add Expense Modal (Global FAB)

**Files:**
- Create: `components/quick-add-expense.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/layout/mobile-nav.tsx`

**Step 1: Create the QuickAddExpense component**

Create `components/quick-add-expense.tsx`:

```tsx
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

  if (groups.length === 0) return null;

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
      {/* Desktop FAB - bottom right, above fold */}
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
```

**Step 2: Update the dashboard layout to include QuickAddExpense**

Modify `app/(dashboard)/layout.tsx`. Add these imports at top:
```typescript
import { fetchGroups } from "@/actions/groups";
import { QuickAddExpense } from "@/components/quick-add-expense";
```

In the component body, after `const serializedUser = ...`, add:
```typescript
const groups = await fetchGroups();
```

Inside the JSX, add `<QuickAddExpense>` after `<MobileNav />`:
```tsx
<MobileNav />
<QuickAddExpense groups={JSON.parse(JSON.stringify(groups))} currentUserId={serializedUser.id} />
```

**Note:** `JSON.parse(JSON.stringify(groups))` serializes Date objects from Prisma for client components.

**Step 3: Update mobile nav to open the quick-add modal instead of navigating**

Modify `components/layout/mobile-nav.tsx`. The center "Add" button currently links to `/expenses?create=true`. Change it to trigger the global quick-add. However, since MobileNav doesn't have access to the QuickAddExpense state, the simplest approach is: keep the mobile nav "Add" button as a Link that opens the expenses page with `?create=true`. The desktop FAB handles the global add. This avoids prop-drilling or context overhead.

**No change needed to mobile-nav.tsx** — the existing behavior is acceptable for mobile.

**Step 4: Verify**

Run:
```bash
npx next build
```
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add components/quick-add-expense.tsx app/\(dashboard\)/layout.tsx
git commit -m "feat: add global quick-add expense FAB on desktop"
```

---

### Task 4: Settle-Up Flow

**Files:**
- Modify: `components/groups/group-detail-client.tsx`

**Step 1: Add settle-up dialog to the balances tab**

Modify `components/groups/group-detail-client.tsx`:

1. Add imports at top:
```typescript
import { createSettlement } from "@/actions/settlements";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

2. Add state after the existing state declarations:
```typescript
const [settleOpen, setSettleOpen] = useState(false);
const [settleFrom, setSettleFrom] = useState("");
const [settleTo, setSettleTo] = useState("");
const [settleAmount, setSettleAmount] = useState("");
const [settleNotes, setSettleNotes] = useState("");
const [settling, setSettling] = useState(false);
```

3. Add handler functions:
```typescript
function openSettleDialog(from?: string, to?: string, amount?: number) {
  setSettleFrom(from ?? currentUserId);
  setSettleTo(to ?? "");
  setSettleAmount(amount ? amount.toFixed(2) : "");
  setSettleNotes("");
  setSettleOpen(true);
}

async function handleSettle() {
  if (!settleFrom || !settleTo || !settleAmount) return;
  setSettling(true);
  try {
    await createSettlement({
      groupId: group.id,
      fromMember: settleFrom,
      toMember: settleTo,
      amount: parseFloat(settleAmount),
      settlementDate: new Date().toISOString().split("T")[0],
      notes: settleNotes || undefined,
    });
    toast.success("Settlement recorded!");
    setSettleOpen(false);
    // Page will revalidate via the server action
  } catch {
    toast.error("Failed to record settlement");
  } finally {
    setSettling(false);
  }
}
```

4. In the balances tab section, add a "Settle Up" button at the top of the suggested settlements area, before the `<h3>` tag:
```tsx
<div className="flex items-center justify-between">
  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    Suggested settlements
  </h3>
  {simplifiedTransfers.length > 0 && (
    <Button size="sm" variant="outline" onClick={() => openSettleDialog()}>
      Settle Up
    </Button>
  )}
</div>
```

5. For each suggested settlement card, add a "Settle" button inside the card's flex container:
```tsx
<div className="flex items-center justify-between">
  <p className="text-sm">
    <span className="font-medium">{fromName}</span>
    {" pays "}
    <span className="font-medium">{toName}</span>
  </p>
  <div className="flex items-center gap-2">
    <AmountDisplay amount={t.amount} currency={group.currency} className="text-base font-bold" />
    <Button
      size="sm"
      variant="default"
      onClick={() => openSettleDialog(t.from, t.to, t.amount)}
    >
      Settle
    </Button>
  </div>
</div>
```

6. Add the settle-up Dialog at the end of the component (before the closing `</div>`):
```tsx
<Dialog open={settleOpen} onOpenChange={setSettleOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Record Settlement</DialogTitle>
      <DialogDescription>
        Record a payment between group members.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>From (who paid)</Label>
        <Select value={settleFrom} onValueChange={setSettleFrom}>
          <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.id === currentUserId ? `${m.fullName} (You)` : m.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>To (who received)</Label>
        <Select value={settleTo} onValueChange={setSettleTo}>
          <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
          <SelectContent>
            {members.filter((m) => m.id !== settleFrom).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.id === currentUserId ? `${m.fullName} (You)` : m.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Amount ({group.currency})</Label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={settleAmount}
          onChange={(e) => setSettleAmount(e.target.value)}
          className="font-mono"
          placeholder="0.00"
        />
      </div>
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Input
          value={settleNotes}
          onChange={(e) => setSettleNotes(e.target.value)}
          placeholder="e.g. Venmo, cash, bank transfer"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => setSettleOpen(false)}>Cancel</Button>
        <Button onClick={handleSettle} disabled={settling || !settleFrom || !settleTo || !settleAmount}>
          {settling ? "Recording..." : "Record Settlement"}
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**Step 2: Verify**

Run:
```bash
npx next build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/groups/group-detail-client.tsx
git commit -m "feat: add settle-up flow with pre-filled suggestions on group balances tab"
```

---

### Task 5: Group Archive

**Files:**
- Modify: `actions/groups.ts`
- Modify: `components/groups/group-detail-client.tsx`
- Modify: `components/groups/group-list.tsx`
- Modify: `actions/group-detail.ts`

**Step 1: Add archive/restore server actions**

Add to `actions/groups.ts`:

```typescript
export async function archiveGroup(id: string) {
  const user = await getAuthenticatedUser();
  const group = await prisma.group.findFirst({ where: { id, ownerId: user.id } });
  if (!group) throw new Error("Group not found or not authorized");

  await prisma.group.update({ where: { id }, data: { status: "archived" } });
  revalidatePath("/groups");
  revalidatePath(`/groups/${id}`);
  revalidatePath("/");
}

export async function restoreGroup(id: string) {
  const user = await getAuthenticatedUser();
  const group = await prisma.group.findFirst({ where: { id, ownerId: user.id } });
  if (!group) throw new Error("Group not found or not authorized");

  await prisma.group.update({ where: { id }, data: { status: "active" } });
  revalidatePath("/groups");
  revalidatePath(`/groups/${id}`);
  revalidatePath("/");
}
```

**Step 2: Add status to GroupDetailData**

In `actions/group-detail.ts`, add `status: string` to the `group` type in `GroupDetailData`, and add `status: true` to the group select:
```typescript
select: { id: true, name: true, description: true, currency: true, ownerId: true, status: true },
```

**Step 3: Add archive button to group detail page**

In `components/groups/group-detail-client.tsx`:

1. Add imports: `import { archiveGroup, restoreGroup } from "@/actions/groups";` and `import { Archive, ArchiveRestore } from "lucide-react";`

2. Compute `isOwner` and `isArchived`:
```typescript
const isOwner = group.ownerId === currentUserId;
const isArchived = group.status === "archived";
const allSettled = simplifiedTransfers.length === 0;
```

3. In the header area (after the Invite button), add archive controls for owner:
```tsx
{isOwner && !isArchived && allSettled && (
  <Button variant="outline" size="sm" onClick={async () => {
    await archiveGroup(group.id);
    toast.success("Group archived");
  }}>
    <Archive className="h-4 w-4" />
    Archive
  </Button>
)}
{isOwner && isArchived && (
  <Button variant="outline" size="sm" onClick={async () => {
    await restoreGroup(group.id);
    toast.success("Group restored");
  }}>
    <ArchiveRestore className="h-4 w-4" />
    Restore
  </Button>
)}
```

4. Show archived banner at top of content:
```tsx
{isArchived && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
    This group is archived. No new expenses or settlements can be added.
  </div>
)}
```

5. Hide "Add expense" links and settle buttons when archived.

**Step 4: Separate archived groups in GroupList**

In `components/groups/group-list.tsx`:

1. Split groups into active and archived:
```typescript
const activeGroups = groups.filter((g) => (g as any).status !== "archived");
const archivedGroups = groups.filter((g) => (g as any).status === "archived");
```

2. Render archived groups in a separate muted section after active groups, with `opacity-60` styling and an "Archived" header.

**Step 5: Ensure fetchGroups returns status**

In `actions/groups.ts`, the `fetchGroups` query already returns all fields via `include`. Since `status` is a direct field on Group, it's automatically included. No change needed.

**Step 6: Verify**

Run: `npx next build`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add actions/groups.ts actions/group-detail.ts components/groups/group-detail-client.tsx components/groups/group-list.tsx
git commit -m "feat: add group archive/restore with read-only mode for archived groups"
```

---

### Task 6: Pagination

**Files:**
- Modify: `actions/expenses.ts`
- Modify: `actions/settlements.ts`
- Modify: `components/expenses/expense-list.tsx`

**Step 1: Add cursor-based pagination to fetchExpenses**

Modify `fetchExpenses` in `actions/expenses.ts` to accept pagination params:

```typescript
export async function fetchExpenses(groupId?: string, cursor?: string, limit = 20) {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const expenses = await prisma.expense.findMany({
    where: {
      groupId: groupId && groupIds.includes(groupId) ? groupId : { in: groupIds },
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      payer: { select: { id: true, fullName: true, avatarUrl: true } },
      splits: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Fetch one extra to determine if there's a next page
  });

  const hasMore = expenses.length > limit;
  const items = (hasMore ? expenses.slice(0, limit) : expenses).map((e) => ({
    ...e,
    amount: parseFloat(String(e.amount)),
    splits: e.splits.map((s) => ({
      ...s,
      share: parseFloat(String(s.share)),
    })),
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}
```

**Step 2: Update ExpenseList to handle pagination**

In `components/expenses/expense-list.tsx`:

1. Change `ExpenseListProps` to accept paginated data:
```typescript
interface ExpenseListProps {
  initialExpenses: ExpenseWithDetails[];
  initialNextCursor: string | null;
  groups: GroupWithMembers[];
  currentUserId: string;
}
```

2. Add state for accumulated expenses and cursor:
```typescript
const [allExpenses, setAllExpenses] = useState(initialExpenses);
const [nextCursor, setNextCursor] = useState(initialNextCursor);
const [loadingMore, setLoadingMore] = useState(false);
```

3. Add load more handler:
```typescript
const handleLoadMore = async () => {
  if (!nextCursor) return;
  setLoadingMore(true);
  try {
    const { items, nextCursor: newCursor } = await fetchExpenses(
      filterGroupId !== "all" ? filterGroupId : undefined,
      nextCursor
    );
    setAllExpenses((prev) => [...prev, ...items]);
    setNextCursor(newCursor);
  } catch {
    toast.error("Failed to load more expenses");
  } finally {
    setLoadingMore(false);
  }
};
```

4. Add "Load more" button at the bottom of the expense grid:
```tsx
{nextCursor && (
  <div className="flex justify-center pt-4">
    <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
      {loadingMore ? "Loading..." : "Load more"}
    </Button>
  </div>
)}
```

5. Use `allExpenses` instead of `expenses` in the `filteredExpenses` useMemo.

**Step 3: Update ExpensesPage**

In `app/(dashboard)/expenses/page.tsx`, update to use the new paginated return:
```typescript
const [user, { items: expenses, nextCursor }, groups] = await Promise.all([
  getAuthenticatedUser(),
  fetchExpenses(),
  fetchGroups(),
]);

return (
  <ExpenseList
    initialExpenses={expenses}
    initialNextCursor={nextCursor}
    groups={groups}
    currentUserId={user.id}
  />
);
```

**Step 4: Add pagination to fetchSettlements similarly**

Apply the same pattern to `actions/settlements.ts`.

**Step 5: Verify**

Run: `npx next build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add actions/expenses.ts actions/settlements.ts components/expenses/expense-list.tsx app/\(dashboard\)/expenses/page.tsx
git commit -m "feat: add cursor-based pagination to expenses and settlements"
```

---

### Task 7: Analytics Dashboard

**Files:**
- Create: `actions/analytics.ts`
- Create: `app/(dashboard)/analytics/page.tsx`
- Create: `components/analytics/analytics-client.tsx`
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/layout/mobile-nav.tsx`

**Step 1: Install recharts**

Run:
```bash
npm install recharts
```

**Step 2: Create analytics server action**

Create `actions/analytics.ts`:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export type AnalyticsData = {
  monthlySpending: Array<{ month: string; total: number }>;
  categoryBreakdown: Array<{ category: string; total: number }>;
  groupComparison: Array<{ groupId: string; groupName: string; total: number }>;
  topSpenders: Array<{ userId: string; userName: string; total: number }>;
};

export async function fetchAnalyticsData(groupId?: string): Promise<AnalyticsData> {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = groupId
    ? memberships.map((m) => m.groupId).includes(groupId)
      ? [groupId]
      : []
    : memberships.map((m) => m.groupId);

  if (groupIds.length === 0) {
    return { monthlySpending: [], categoryBreakdown: [], groupComparison: [], topSpenders: [] };
  }

  // Fetch all expenses for user's groups in one query
  const expenses = await prisma.expense.findMany({
    where: { groupId: { in: groupIds } },
    include: {
      group: { select: { id: true, name: true } },
      payer: { select: { id: true, fullName: true } },
    },
    orderBy: { expenseDate: "asc" },
  });

  // Monthly spending (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const monthlyMap = new Map<string, number>();
  for (const e of expenses) {
    const date = new Date(e.expenseDate);
    if (date < sixMonthsAgo) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + parseFloat(String(e.amount)));
  }
  const monthlySpending = Array.from(monthlyMap.entries())
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Category breakdown
  const catMap = new Map<string, number>();
  for (const e of expenses) {
    const cat = e.category ?? "other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + parseFloat(String(e.amount)));
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  // Group comparison
  const groupMap = new Map<string, { name: string; total: number }>();
  for (const e of expenses) {
    const existing = groupMap.get(e.group.id) ?? { name: e.group.name, total: 0 };
    existing.total += parseFloat(String(e.amount));
    groupMap.set(e.group.id, existing);
  }
  const groupComparison = Array.from(groupMap.entries())
    .map(([groupId, { name, total }]) => ({
      groupId,
      groupName: name,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  // Top spenders
  const spenderMap = new Map<string, { name: string; total: number }>();
  for (const e of expenses) {
    if (!e.payer) continue;
    const existing = spenderMap.get(e.payer.id) ?? { name: e.payer.fullName ?? "Unknown", total: 0 };
    existing.total += parseFloat(String(e.amount));
    spenderMap.set(e.payer.id, existing);
  }
  const topSpenders = Array.from(spenderMap.entries())
    .map(([userId, { name, total }]) => ({
      userId,
      userName: name,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return { monthlySpending, categoryBreakdown, groupComparison, topSpenders };
}
```

**Step 3: Create analytics client component**

Create `components/analytics/analytics-client.tsx` with:
- Four chart sections using recharts: `BarChart` for monthly, `PieChart` for categories, `BarChart` (horizontal) for groups, ranked list for spenders
- Group filter dropdown at top
- Use `formatCurrency` for tooltips
- Use category emoji + labels from `lib/categories.ts`
- Wrap chart components in `"use client"` with lazy loading via `dynamic` or conditional render

**Step 4: Create the page**

Create `app/(dashboard)/analytics/page.tsx`:

```typescript
import { fetchAnalyticsData } from "@/actions/analytics";
import { fetchGroups } from "@/actions/groups";
import { getAuthenticatedUser } from "@/lib/auth";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export default async function AnalyticsPage() {
  const [user, data, groups] = await Promise.all([
    getAuthenticatedUser(),
    fetchAnalyticsData(),
    fetchGroups(),
  ]);

  return (
    <AnalyticsClient
      data={data}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
    />
  );
}
```

**Step 5: Add analytics to navigation**

In `components/layout/sidebar.tsx`, add to `navItems`:
```typescript
{ label: "Analytics", path: "/analytics", icon: BarChart3 },
```
Import `BarChart3` from `lucide-react`.

In `components/layout/mobile-nav.tsx`, add analytics item (replace or add alongside existing items — keep it to 5 items max for mobile, so perhaps replace with a structure that works).

**Step 6: Verify**

Run: `npx next build`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add actions/analytics.ts app/\(dashboard\)/analytics/ components/analytics/ components/layout/sidebar.tsx components/layout/mobile-nav.tsx
git commit -m "feat: add analytics dashboard with spending charts and group comparison"
```

---

### Task 8: Receipt Image Upload

**Files:**
- Create: `lib/uploadthing.ts`
- Create: `app/api/uploadthing/core.ts`
- Create: `app/api/uploadthing/route.ts`
- Modify: `components/expenses/expense-form.tsx`
- Modify: `actions/expenses.ts`

**Step 1: Install uploadthing**

Run:
```bash
npm install uploadthing @uploadthing/react
```

**Step 2: Add UPLOADTHING_TOKEN to `.env.local`**

Get the token from https://uploadthing.com/dashboard and add:
```
UPLOADTHING_TOKEN="your-token-here"
```

**Step 3: Create uploadthing core config**

Create `app/api/uploadthing/core.ts`:
```typescript
import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  receiptUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .onUploadComplete(({ file }) => {
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
```

Create `app/api/uploadthing/route.ts`:
```typescript
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({ router: ourFileRouter });
```

**Step 4: Create uploadthing client helper**

Create `lib/uploadthing.ts`:
```typescript
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
```

**Step 5: Add receipt upload to ExpenseForm**

In `components/expenses/expense-form.tsx`:
1. Import `useUploadThing` from `@/lib/uploadthing`
2. Add `receiptUrl` state
3. Add upload zone below notes (simple button + preview)
4. Pass `receiptUrl` to `onSubmit`

**Step 6: Update createExpense and updateExpense**

In `actions/expenses.ts`, add `receiptUrl?: string` to input types and persist to DB.

**Step 7: Verify**

Run: `npx next build`
Expected: Build succeeds.

**Step 8: Commit**

```bash
git add lib/uploadthing.ts app/api/uploadthing/ components/expenses/expense-form.tsx actions/expenses.ts
git commit -m "feat: add receipt image upload via Uploadthing"
```

---

### Task 9: Recurring Expenses

**Files:**
- Modify: `components/expenses/expense-form.tsx`
- Modify: `actions/expenses.ts`
- Create: `app/api/cron/recurring-expenses/route.ts`

**Step 1: Add recurring fields to expense form**

In `components/expenses/expense-form.tsx`:
1. Add `isRecurring` state (boolean toggle)
2. Add `recurrenceRule` state (select dropdown: weekly, biweekly, monthly, yearly)
3. Show the dropdown only when toggle is on
4. Pass both fields to onSubmit

**Step 2: Update createExpense**

In `actions/expenses.ts`, add `isRecurring?: boolean` and `recurrenceRule?: string` to input. When `isRecurring` is true, compute `nextOccurrence` based on rule and `expenseDate`:
```typescript
function computeNextOccurrence(date: Date, rule: string): Date {
  const next = new Date(date);
  switch (rule) {
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "biweekly": next.setDate(next.getDate() + 14); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "yearly": next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}
```

**Step 3: Create cron API route**

Create `app/api/cron/recurring-expenses/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { expenseAddedEmail } from "@/lib/email/templates";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueExpenses = await prisma.expense.findMany({
    where: {
      isRecurring: true,
      nextOccurrence: { lte: now },
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      payer: { select: { id: true, fullName: true } },
      splits: true,
    },
  });

  let created = 0;
  for (const expense of dueExpenses) {
    // Create duplicate expense
    await prisma.expense.create({
      data: {
        groupId: expense.groupId,
        payerId: expense.payerId,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        splitType: expense.splitType,
        expenseDate: now,
        notes: expense.notes,
        splits: {
          create: expense.splits.map((s) => ({
            memberId: s.memberId,
            share: s.share,
          })),
        },
      },
    });

    // Compute next occurrence
    const next = new Date(expense.nextOccurrence!);
    switch (expense.recurrenceRule) {
      case "weekly": next.setDate(next.getDate() + 7); break;
      case "biweekly": next.setDate(next.getDate() + 14); break;
      case "monthly": next.setMonth(next.getMonth() + 1); break;
      case "yearly": next.setFullYear(next.getFullYear() + 1); break;
    }

    await prisma.expense.update({
      where: { id: expense.id },
      data: { nextOccurrence: next },
    });

    created++;
  }

  return NextResponse.json({ created });
}
```

**Step 4: Add CRON_SECRET to .env.local**

```
CRON_SECRET="your-random-secret"
```

**Step 5: Verify**

Run: `npx next build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add components/expenses/expense-form.tsx actions/expenses.ts app/api/cron/
git commit -m "feat: add recurring expenses with cron-based auto-creation"
```

---

### Task 10: Push Notifications

**Files:**
- Create: `public/sw.js`
- Create: `lib/push.ts`
- Create: `actions/push.ts`
- Modify: `actions/expenses.ts`
- Modify: `actions/settlements.ts`
- Modify: `components/settings/settings-client.tsx` (or wherever settings are)

**Step 1: Install web-push**

Run:
```bash
npm install web-push
npm install -D @types/web-push
```

**Step 2: Generate VAPID keys**

Run:
```bash
npx web-push generate-vapid-keys
```

Add to `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-key"
VAPID_PRIVATE_KEY="your-private-key"
```

**Step 3: Create service worker**

Create `public/sw.js`:
```javascript
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "SplitEase", {
      body: data.body ?? "You have a new notification",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

**Step 4: Create push utility**

Create `lib/push.ts`:
```typescript
import webPush from "web-push";

webPush.setVapidDetails(
  "mailto:noreply@splitease.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
) {
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
  } catch {
    // Subscription expired or invalid — could clean up here
  }
}
```

**Step 5: Create push subscription server actions**

Create `actions/push.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function subscribePush(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const user = await getAuthenticatedUser();

  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: user.id, endpoint: subscription.endpoint } },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    update: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  });
}

export async function unsubscribePush(endpoint: string) {
  const user = await getAuthenticatedUser();

  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, endpoint },
  });
}
```

**Step 6: Integrate push into expense/settlement creation**

In `actions/expenses.ts` `createExpense`, after the email notification loop, add push:
```typescript
import { sendPushNotification } from "@/lib/push";

// Send push notifications
const pushSubs = await prisma.pushSubscription.findMany({
  where: {
    userId: { in: groupMembers.filter((gm) => gm.member.id !== input.payerId).map((gm) => gm.member.id) },
  },
});
for (const sub of pushSubs) {
  void sendPushNotification(sub, {
    title: `New expense in ${expense.group.name}`,
    body: `${payerName} added "${expense.description}" — ${parseFloat(String(expense.amount)).toFixed(2)} ${expense.group.currency}`,
    url: `/groups/${input.groupId}`,
  });
}
```

Apply similar pattern in `actions/settlements.ts` `createSettlement`.

**Step 7: Add push notification toggle to settings**

In the settings page/component, add a section to enable/disable browser push notifications. Use the Push API to request permission and subscribe/unsubscribe.

**Step 8: Verify**

Run: `npx next build`
Expected: Build succeeds.

**Step 9: Commit**

```bash
git add public/sw.js lib/push.ts actions/push.ts actions/expenses.ts actions/settlements.ts components/settings/
git commit -m "feat: add browser push notifications for expenses and settlements"
```

---

### Task 11: Test Suite

**Files:**
- Create: `vitest.config.ts`
- Create: `__tests__/lib/simplify-debts.test.ts`
- Create: `__tests__/lib/utils.test.ts`
- Create: `__tests__/lib/categories.test.ts`
- Modify: `package.json`

**Step 1: Install test dependencies**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

**Step 2: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

**Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Write unit tests for simplify-debts**

Create `__tests__/lib/simplify-debts.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { simplifyDebts, computeNetBalances } from "@/lib/simplify-debts";

describe("simplifyDebts", () => {
  it("returns empty for zero balances", () => {
    expect(simplifyDebts({})).toEqual([]);
  });

  it("returns empty when all balances are zero", () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it("simplifies a simple two-person debt", () => {
    const result = simplifyDebts({ a: 50, b: -50 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: "b", to: "a", amount: 50 });
  });

  it("simplifies three-person circular debt", () => {
    // A is owed 30, B owes 20, C owes 10
    const result = simplifyDebts({ a: 30, b: -20, c: -10 });
    expect(result).toHaveLength(2);
    const totalTransferred = result.reduce((sum, t) => sum + t.amount, 0);
    expect(totalTransferred).toBe(30);
  });

  it("minimizes transactions with 4 people", () => {
    const result = simplifyDebts({ a: 40, b: -10, c: -20, d: -10 });
    // Should produce at most 3 transfers (N-1 for N people with non-zero)
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("handles near-zero balances (rounding)", () => {
    const result = simplifyDebts({ a: 0.001, b: -0.001 });
    expect(result).toEqual([]);
  });
});

describe("computeNetBalances", () => {
  it("returns empty for no data", () => {
    expect(computeNetBalances([], [])).toEqual({});
  });

  it("computes correct balances for single expense", () => {
    const result = computeNetBalances(
      [{ payerId: "a", amount: 100, splits: [{ memberId: "a", share: 50 }, { memberId: "b", share: 50 }] }],
      []
    );
    expect(result.a).toBe(50); // paid 100, owes 50 → net +50
    expect(result.b).toBe(-50); // owes 50
  });

  it("accounts for settlements", () => {
    const result = computeNetBalances(
      [{ payerId: "a", amount: 100, splits: [{ memberId: "a", share: 50 }, { memberId: "b", share: 50 }] }],
      [{ fromMember: "b", toMember: "a", amount: 50 }]
    );
    expect(result.a).toBeCloseTo(0);
    expect(result.b).toBeCloseTo(0);
  });

  it("skips expenses with null payer", () => {
    const result = computeNetBalances(
      [{ payerId: null, amount: 100, splits: [{ memberId: "a", share: 100 }] }],
      []
    );
    expect(result.a).toBe(-100);
  });
});
```

**Step 5: Write unit tests for utils**

Create `__tests__/lib/utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { formatCurrency, computeEqualSplit } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(1234.56, "USD")).toBe("$1,234.56");
  });

  it("formats string amounts", () => {
    expect(formatCurrency("99.9", "USD")).toBe("$99.90");
  });

  it("defaults to USD", () => {
    expect(formatCurrency(10)).toBe("$10.00");
  });
});

describe("computeEqualSplit", () => {
  it("returns empty for zero count", () => {
    expect(computeEqualSplit(100, 0)).toEqual([]);
  });

  it("splits evenly when divisible", () => {
    const result = computeEqualSplit(100, 4);
    expect(result).toEqual([25, 25, 25, 25]);
  });

  it("distributes remainder correctly", () => {
    const result = computeEqualSplit(100, 3);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
    // All values should be close
    result.forEach((v) => expect(v).toBeCloseTo(33.33, 1));
  });

  it("handles small amounts", () => {
    const result = computeEqualSplit(0.01, 3);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0.01, 2);
  });
});
```

**Step 6: Write unit tests for categories**

Create `__tests__/lib/categories.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getCategoryEmoji, getCategoryColor, CATEGORIES } from "@/lib/categories";

describe("getCategoryEmoji", () => {
  it("returns emoji for valid category", () => {
    expect(getCategoryEmoji("food")).toBe("🍔");
  });

  it("returns 'other' emoji for unknown category", () => {
    expect(getCategoryEmoji("nonexistent")).toBe(CATEGORIES.other.emoji);
  });

  it("returns 'other' emoji for undefined", () => {
    expect(getCategoryEmoji(undefined)).toBe(CATEGORIES.other.emoji);
  });
});

describe("getCategoryColor", () => {
  it("returns color for valid category", () => {
    expect(getCategoryColor("food")).toBe("text-orange-500");
  });

  it("returns 'other' color for unknown", () => {
    expect(getCategoryColor("nonexistent")).toBe(CATEGORIES.other.color);
  });
});
```

**Step 7: Run tests**

Run:
```bash
npm test
```
Expected: All tests pass.

**Step 8: Commit**

```bash
git add vitest.config.ts __tests__/ package.json package-lock.json
git commit -m "feat: add test suite with Vitest for core utility and algorithm tests"
```

---

### Task 12: Cleanup

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Remove supabase devDependency**

Run:
```bash
npm uninstall supabase
```

**Step 2: Update README**

Update `README.md` to reflect current tech stack:
- Database: Neon PostgreSQL (not Supabase)
- Auth: NextAuth.js v5 (not Supabase Auth)
- Remove references to Supabase env vars
- Add Uploadthing, web-push, recharts to tech stack

**Step 3: Final build verification**

Run:
```bash
npx next build
```
Expected: Build succeeds with zero errors.

**Step 4: Run all tests**

Run:
```bash
npm test
```
Expected: All tests pass.

**Step 5: Commit**

```bash
git add package.json package-lock.json README.md
git commit -m "chore: remove supabase dependency, update README with current tech stack"
```

---

## Verification Checklist

After all tasks:

1. `npx next build` — zero errors
2. `npm test` — all tests pass
3. Quick-add FAB visible on desktop pages, opens expense form in modal
4. Currency shows correctly based on selected group in expense form
5. Group archive: owner can archive when settled, restore later
6. Settle-up: "Settle" buttons on balances tab, pre-filled dialog works
7. Analytics: `/analytics` page shows 4 chart sections with data
8. Receipt upload: can attach image to expense, thumbnail shows
9. Recurring: toggle + frequency in form, cron endpoint responds
10. Pagination: expenses page loads 20 at a time with "Load more"
11. Push: service worker registered, notifications sent on expense/settlement
12. Tests: `npm test` runs ~20+ tests covering simplify-debts, utils, categories
