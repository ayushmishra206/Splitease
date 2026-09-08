"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Copy,
  LogOut,
  MoreVertical,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";
import { dateOnlyKey, formatDateOnly } from "@/lib/dates";
import type { GroupDetailData } from "@/actions/group-detail";
import { archiveGroup, restoreGroup, leaveGroup } from "@/actions/groups";
import { createSettlement } from "@/actions/settlements";
import { updateExpense, deleteExpense } from "@/actions/expenses";
import { simplifyDebts, computeNetBalances } from "@/lib/simplify-debts";
import { buildExpenseFormDefaults } from "@/lib/expenses-shared";
import type { ExpenseInput, SettlementInput } from "@/lib/validation";
import type { GroupWithMembers } from "@/lib/types";
import { useQuickAdd } from "@/components/quick-add-expense";
import { AmountDisplay } from "@/components/ui/amount-display";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { ExpenseDetailDialog, payerSummary, type ExpenseView } from "@/components/expenses/expense-detail-dialog";
import { SettlementForm } from "@/components/settlements/settlement-form";
import { GroupMemberManager } from "@/components/groups/group-member-manager";

interface GroupDetailClientProps {
  data: GroupDetailData;
  currentUserId: string;
}

type TabId = "expenses" | "balances" | "activity";
type GroupExpense = GroupDetailData["expenses"][number];

function formatDateHeader(dateKey: string): string {
  const today = dateOnlyKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === today) return "Today";
  if (dateKey === dateOnlyKey(yesterday)) return "Yesterday";
  return formatDateOnly(dateKey);
}

export function GroupDetailClient({ data, currentUserId }: GroupDetailClientProps) {
  const router = useRouter();
  const { open: openQuickAdd } = useQuickAdd();
  const { group, members, expenses, settlements, activityLogs, totals } = data;

  const [activeTab, setActiveTab] = useState<TabId>("expenses");
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleDefaults, setSettleDefaults] = useState<Partial<SettlementInput>>({});
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
  const [editExpense, setEditExpense] = useState<GroupExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupExpense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = group.ownerId === currentUserId;
  const isArchived = group.status === "archived";

  const memberNameMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.fullName])),
    [members]
  );
  const nameOf = (id: string, you = "You") => (id === currentUserId ? you : memberNameMap[id] ?? "Former member");

  // Shape the group the way the shared forms expect it
  const groupForForms: GroupWithMembers = useMemo(
    () => ({
      id: group.id,
      name: group.name,
      description: group.description,
      currency: group.currency,
      status: group.status,
      ownerId: group.ownerId,
      createdAt: "",
      updatedAt: "",
      owner: { id: group.ownerId, fullName: memberNameMap[group.ownerId] ?? null, avatarUrl: null },
      members: members.map((m) => ({
        memberId: m.id,
        role: m.role,
        member: { id: m.id, fullName: m.fullName, avatarUrl: m.avatarUrl },
      })),
    }),
    [group, members, memberNameMap]
  );

  // Balances
  const netBalances = useMemo(() => computeNetBalances(expenses, settlements), [expenses, settlements]);
  const simplifiedTransfers = useMemo(() => simplifyDebts(netBalances), [netBalances]);
  const myBalance = netBalances[currentUserId] ?? 0;
  const allSettled = simplifiedTransfers.length === 0;

  // Expenses grouped by day
  const expensesByDate = useMemo(() => {
    const map = new Map<string, GroupExpense[]>();
    for (const expense of expenses) {
      const key = dateOnlyKey(expense.expenseDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(expense);
    }
    return map;
  }, [expenses]);

  // Activity feed
  const activities = useMemo(
    () =>
      activityLogs.length > 0
        ? activityLogs.map((log) => ({
            type: log.entityType as "expense" | "settlement",
            text: log.description,
            userName: log.userName,
            date: new Date(log.createdAt),
          }))
        : [
            ...expenses.map((e) => ({
              type: "expense" as const,
              text: `Added "${e.description}" — ${formatCurrency(e.amount, group.currency)}`,
              userName: e.createdByName,
              date: new Date(e.createdAt),
            })),
            ...settlements.map((s) => ({
              type: "settlement" as const,
              text: `${s.fromName} settled ${formatCurrency(s.amount, group.currency)} with ${s.toName}`,
              userName: s.fromName,
              date: new Date(s.createdAt),
            })),
          ].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [activityLogs, expenses, settlements, group.currency]
  );

  function handleCopyInvite() {
    const url = `${window.location.origin}/groups/${group.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Group link copied"))
      .catch(() => toast.error("Could not copy link"));
  }

  function openSettleDialog(from?: string, to?: string, amount?: number) {
    setSettleDefaults({
      groupId: group.id,
      fromMember: from ?? currentUserId,
      toMember: to,
      amount,
    });
    setSettleOpen(true);
  }

  async function handleSettle(input: SettlementInput) {
    try {
      await createSettlement(input);
      toast.success("Settlement recorded");
      setSettleOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record settlement");
    }
  }

  async function handleUpdateExpense(input: ExpenseInput) {
    if (!editExpense) return;
    try {
      await updateExpense({ id: editExpense.id, ...input });
      toast.success("Expense updated");
      setEditExpense(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update expense");
    }
  }

  async function handleDeleteExpense() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      toast.success("Expense deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete expense");
    } finally {
      setDeleting(false);
    }
  }

  async function runGroupAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canDeleteExpense = (e: GroupExpense) =>
    e.createdById === currentUserId || e.payers.some((p) => p.memberId === currentUserId) || isOwner;

  const toExpenseView = (e: GroupExpense): ExpenseView => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    currency: group.currency,
    category: e.category,
    splitType: e.splitType,
    expenseDate: e.expenseDate,
    notes: e.notes,
    receiptUrl: e.receiptUrl,
    isRecurring: e.isRecurring,
    recurrenceRule: e.recurrenceRule,
    createdByName: e.createdByName,
    payers: e.payers.map((p) => ({ memberId: p.memberId, name: p.memberName, amount: p.amount })),
    splits: e.splits.map((s) => ({ memberId: s.memberId, name: s.memberName, share: s.share })),
  });

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "expenses", label: "Expenses", count: expenses.length },
    { id: "balances", label: "Balances", count: simplifiedTransfers.length || undefined },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/groups"
          aria-label="Back to groups"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{group.name}</h1>
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="mt-0.5 flex items-center gap-2 text-left"
          >
            <AvatarStack names={members.map((m) => m.fullName)} max={4} size="sm" />
            <span className="text-xs text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </button>
        </div>
        {!isArchived && (
          <Button size="sm" onClick={() => openQuickAdd({ groupId: group.id })}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add expense</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Group actions" disabled={busy}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl">
            <DropdownMenuItem onSelect={handleCopyInvite}>
              <Copy className="h-4 w-4" /> Copy group link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMembersOpen(true)}>
              <Users className="h-4 w-4" /> {isOwner ? "Manage members" : "View members"}
            </DropdownMenuItem>
            {isOwner && !isArchived && (
              <DropdownMenuItem
                disabled={!allSettled}
                onSelect={() => runGroupAction(() => archiveGroup(group.id), "Group archived")}
              >
                <Archive className="h-4 w-4" /> {allSettled ? "Archive group" : "Archive (settle up first)"}
              </DropdownMenuItem>
            )}
            {isOwner && isArchived && (
              <DropdownMenuItem onSelect={() => runGroupAction(() => restoreGroup(group.id), "Group restored")}>
                <ArchiveRestore className="h-4 w-4" /> Restore group
              </DropdownMenuItem>
            )}
            {!isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setLeaveOpen(true)}>
                  <LogOut className="h-4 w-4" /> Leave group
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isArchived && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          This group is archived. No new expenses or settlements can be added.
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryTile label="Total spent" value={formatCurrency(totals.totalSpent, group.currency)} hint={`${totals.expenseCount} expense${totals.expenseCount === 1 ? "" : "s"}`} />
        <SummaryTile label="Your share" value={formatCurrency(totals.yourShare, group.currency)} hint="what you owe in total" />
        <SummaryTile label="You paid" value={formatCurrency(totals.youPaid, group.currency)} hint="out of your pocket" />
        <SummaryTile
          label="Your balance"
          value={`${myBalance > 0.005 ? "+" : myBalance < -0.005 ? "-" : ""}${formatCurrency(Math.abs(myBalance), group.currency)}`}
          hint={myBalance > 0.005 ? "you are owed" : myBalance < -0.005 ? "you owe" : "all settled"}
          tone={myBalance > 0.005 ? "positive" : myBalance < -0.005 ? "negative" : "neutral"}
        />
      </div>

      {/* Tabs */}
      <div className="-mx-4 flex overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex min-h-11 items-center gap-1.5 px-4 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.id ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{tab.count}</span>
            )}
            {activeTab === tab.id && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            )}
          </button>
        ))}
      </div>

      {/* Expenses */}
      {activeTab === "expenses" && (
        <div className="space-y-5">
          {expenses.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="mb-1 text-lg font-medium">No expenses yet</p>
                <p className="mb-4 text-sm text-muted-foreground">Add your first expense to this group</p>
                {!isArchived && (
                  <Button onClick={() => openQuickAdd({ groupId: group.id })}>
                    <Plus className="h-4 w-4" /> Add expense
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            Array.from(expensesByDate.entries()).map(([dateKey, dayExpenses]) => (
              <div key={dateKey}>
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {formatDateHeader(dateKey)}
                </h3>
                <div className="space-y-2">
                  {dayExpenses.map((expense) => {
                    const myShare = expense.splits.find((s) => s.memberId === currentUserId)?.share ?? 0;
                    const myPaid = expense.payers
                      .filter((p) => p.memberId === currentUserId)
                      .reduce((sum, p) => sum + p.amount, 0);
                    const myNet = myPaid - myShare;
                    return (
                      <button
                        key={expense.id}
                        type="button"
                        onClick={() => setSelectedExpense(expense)}
                        className="w-full rounded-2xl border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryBadge category={expense.category ?? undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{expense.description}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {payerSummary(
                                expense.payers.map((p) => ({ memberId: p.memberId, name: p.memberName })),
                                currentUserId
                              )}{" "}
                              paid
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <AmountDisplay amount={expense.amount} currency={group.currency} className="text-sm font-semibold text-foreground" />
                            {Math.abs(myNet) > 0.005 ? (
                              <p className={cn("text-xs font-medium", myNet > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                {myNet > 0 ? `you lent ${formatCurrency(myNet, group.currency)}` : `you owe ${formatCurrency(-myNet, group.currency)}`}
                              </p>
                            ) : myShare > 0 ? (
                              <p className="text-xs text-muted-foreground">even</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">not involved</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Balances */}
      {activeTab === "balances" && (
        <div className="space-y-5">
          {Math.abs(myBalance) > 0.01 && (
            <div
              className={cn(
                "rounded-lg border p-4",
                myBalance > 0
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
              )}
            >
              <p className="text-sm font-medium">
                {myBalance > 0
                  ? `You are owed ${formatCurrency(myBalance, group.currency)} in total`
                  : `You owe ${formatCurrency(Math.abs(myBalance), group.currency)} in total`}
              </p>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Suggested settlements</h3>
              {!isArchived && (
                <Button size="sm" variant="outline" onClick={() => openSettleDialog()}>
                  Record payment
                </Button>
              )}
            </div>
            {simplifiedTransfers.length === 0 ? (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center text-center">
                  <p className="mb-2 text-2xl">🎉</p>
                  <p className="mb-1 text-lg font-medium">All settled up!</p>
                  <p className="text-sm text-muted-foreground">No outstanding balances in this group</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {simplifiedTransfers.map((t, i) => {
                  const involvesMe = t.from === currentUserId || t.to === currentUserId;
                  return (
                    <Card key={i} className={cn("py-3", involvesMe && "border-emerald-200 dark:border-emerald-800")}>
                      <CardContent className="px-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 text-sm">
                            <span className="font-medium">{nameOf(t.from)}</span>
                            {" pays "}
                            <span className="font-medium">{nameOf(t.to, "you")}</span>
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <AmountDisplay amount={t.amount} currency={group.currency} className="text-base font-bold" />
                            {!isArchived && (
                              <Button size="sm" onClick={() => openSettleDialog(t.from, t.to, t.amount)}>
                                Settle
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Everyone's net position */}
          {members.length > 1 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Net balances</h3>
              <ul className="divide-y rounded-2xl border bg-card">
                {members.map((m) => {
                  const bal = netBalances[m.id] ?? 0;
                  return (
                    <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="truncate">{nameOf(m.id)}</span>
                      {Math.abs(bal) < 0.01 ? (
                        <span className="text-muted-foreground">settled</span>
                      ) : (
                        <AmountDisplay amount={bal} currency={group.currency} showSign className="font-semibold" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {settlements.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Payments recorded</h3>
              <ul className="divide-y rounded-2xl border bg-card">
                {settlements.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate">
                        <span className="font-medium">{nameOf(s.fromMember)}</span>
                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{nameOf(s.toMember)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateOnly(s.settlementDate)}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(s.amount, group.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Edit or delete payments from the <Link href="/settlements" className="underline">Settlements</Link> page.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Activity */}
      {activeTab === "activity" && (
        <div className="space-y-1">
          {activities.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </CardContent>
            </Card>
          ) : (
            activities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    activity.type === "expense" ? "bg-emerald-500" : "bg-blue-500"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.userName} &middot; {formatDistanceToNow(activity.date, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Expense detail */}
      <ExpenseDetailDialog
        expense={selectedExpense ? toExpenseView(selectedExpense) : null}
        currentUserId={currentUserId}
        canEdit={!isArchived}
        canDelete={!isArchived && !!selectedExpense && canDeleteExpense(selectedExpense)}
        onClose={() => setSelectedExpense(null)}
        onEdit={() => {
          setEditExpense(selectedExpense);
          setSelectedExpense(null);
        }}
        onDelete={() => {
          setDeleteTarget(selectedExpense);
          setSelectedExpense(null);
        }}
      />

      {/* Edit expense */}
      <Dialog open={!!editExpense} onOpenChange={(v) => !v && setEditExpense(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
            <DialogDescription>
              {editExpense && editExpense.createdById && editExpense.createdById !== currentUserId
                ? `Added by ${editExpense.createdByName}. They will be notified of your changes.`
                : "Update the details and how it is split."}
            </DialogDescription>
          </DialogHeader>
          {editExpense && (
            <ExpenseForm
              groups={[groupForForms]}
              currentUserId={currentUserId}
              lockGroup
              defaultValues={buildExpenseFormDefaults(
                { ...editExpense, groupId: group.id, payers: editExpense.payers.map((p) => ({ memberId: p.memberId, amount: p.amount })) },
                dateOnlyKey
              )}
              onSubmit={handleUpdateExpense}
              onCancel={() => setEditExpense(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete expense */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.description}&quot;? This cannot be undone and will change everyone&apos;s balances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteExpense} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settle up */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record settlement</DialogTitle>
            <DialogDescription>Record a payment between group members.</DialogDescription>
          </DialogHeader>
          {settleOpen && (
            <SettlementForm
              groups={[groupForForms]}
              currentUserId={currentUserId}
              lockGroup
              defaultValues={settleDefaults}
              onSubmit={handleSettle}
              onCancel={() => setSettleOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Members */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isOwner ? "Manage members" : "Members"}</DialogTitle>
            <DialogDescription>
              {isOwner ? "Add or remove members. Members with a balance must settle up first." : `${members.length} people in ${group.name}`}
            </DialogDescription>
          </DialogHeader>
          {isOwner ? (
            <GroupMemberManager
              groupId={group.id}
              ownerId={group.ownerId}
              members={groupForForms.members}
              currentUserId={currentUserId}
              onUpdate={() => router.refresh()}
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{nameOf(m.id)}</span>
                  {m.role === "owner" && <span className="text-xs text-muted-foreground">Owner</span>}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave group */}
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {group.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will stop seeing this group&apos;s expenses. You can only leave once your balance is settled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await leaveGroup(group.id);
                  toast.success("You left the group");
                  router.push("/groups");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not leave group");
                  setBusy(false);
                }
              }}
            >
              Leave group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card px-3 py-2.5 sm:px-4 sm:py-3",
        tone === "positive" && "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30",
        tone === "negative" && "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
      )}
    >
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "truncate font-mono text-base font-semibold tabular-nums sm:text-lg",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
