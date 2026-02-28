"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { GroupDetailData } from "@/actions/group-detail";
import { createSettlement } from "@/actions/settlements";
import { simplifyDebts, computeNetBalances } from "@/lib/simplify-debts";
import { AmountDisplay } from "@/components/ui/amount-display";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

interface GroupDetailClientProps {
  data: GroupDetailData;
  currentUserId: string;
}

type TabId = "expenses" | "balances" | "activity";

function formatDateHeader(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d, yyyy");
}

export function GroupDetailClient({ data, currentUserId }: GroupDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("expenses");
  const [copied, setCopied] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [settling, setSettling] = useState(false);
  const { group, members, expenses, settlements } = data;

  const memberNames = members.map((m) => m.fullName);

  function handleCopyInvite() {
    const url = `${window.location.origin}/groups?join=${group.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

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
      router.refresh();
    } catch {
      toast.error("Failed to record settlement");
    } finally {
      setSettling(false);
    }
  }

  // Compute simplified debts for the whole group
  const netBalances = computeNetBalances(expenses, settlements);
  const simplifiedTransfers = simplifyDebts(netBalances);
  const memberNameMap = Object.fromEntries(members.map((m) => [m.id, m.fullName]));

  // Also compute user-centric balances for the header context
  const myBalance = netBalances[currentUserId] ?? 0;

  // Group expenses by date
  const expensesByDate = new Map<string, typeof expenses>();
  for (const expense of expenses) {
    const key = format(new Date(expense.expenseDate), "yyyy-MM-dd");
    if (!expensesByDate.has(key)) expensesByDate.set(key, []);
    expensesByDate.get(key)!.push(expense);
  }

  // Activity feed
  const activities = [
    ...expenses.map((e) => ({
      type: "expense" as const,
      text: `${e.payerId === currentUserId ? "You" : e.payerName} added "${e.description}" — ${formatCurrency(e.amount, group.currency)}`,
      date: new Date(e.createdAt),
    })),
    ...settlements.map((s) => ({
      type: "settlement" as const,
      text: `${s.fromMember === currentUserId ? "You" : s.fromName} settled ${formatCurrency(s.amount, group.currency)} with ${s.toMember === currentUserId ? "you" : s.toName}`,
      date: new Date(s.createdAt),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const tabs: { id: TabId; label: string }[] = [
    { id: "expenses", label: "Expenses" },
    { id: "balances", label: "Balances" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/groups"
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold truncate">{group.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <AvatarStack names={memberNames} max={4} size="sm" />
            <span className="text-xs text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyInvite}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Invite"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          {expenses.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="text-lg font-medium mb-1">No expenses yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first expense to this group
                </p>
                <Button asChild>
                  <Link href={`/expenses?create=true&group=${group.id}`}>Add expense</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            Array.from(expensesByDate.entries()).map(([dateKey, dayExpenses]) => (
              <div key={dateKey}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {formatDateHeader(new Date(dateKey))}
                </h3>
                <div className="space-y-2">
                  {dayExpenses.map((expense) => {
                    const myShare = expense.splits.find((s) => s.memberId === currentUserId)?.share ?? 0;
                    const iPaid = expense.payerId === currentUserId;
                    return (
                      <Card key={expense.id} className="py-4">
                        <CardContent className="py-0">
                          <div className="flex items-center gap-3">
                            <CategoryBadge category={expense.category ?? undefined} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{expense.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {iPaid ? "You" : expense.payerName} paid
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <AmountDisplay
                                amount={expense.amount}
                                currency={group.currency}
                                className="text-sm font-semibold text-foreground"
                              />
                              {myShare > 0 && (
                                <p className={cn(
                                  "text-xs font-medium",
                                  iPaid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                )}>
                                  {iPaid ? `You get back ${formatCurrency(expense.amount - myShare, group.currency)}` : `You owe ${formatCurrency(myShare, group.currency)}`}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "balances" && (
        <div className="space-y-4">
          {/* Your balance summary */}
          {Math.abs(myBalance) > 0.01 && (
            <div className={cn(
              "rounded-lg border p-4",
              myBalance > 0
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
            )}>
              <p className="text-sm font-medium">
                {myBalance > 0
                  ? `You are owed ${formatCurrency(myBalance, group.currency)}`
                  : `You owe ${formatCurrency(Math.abs(myBalance), group.currency)}`}
              </p>
            </div>
          )}

          {/* Simplified settlements */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested settlements
              </h3>
              {simplifiedTransfers.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => openSettleDialog()}>
                  Settle Up
                </Button>
              )}
            </div>
            {simplifiedTransfers.length === 0 ? (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center text-center">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="text-lg font-medium mb-1">All settled up!</p>
                  <p className="text-sm text-muted-foreground">
                    No outstanding balances in this group
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {simplifiedTransfers.map((t, i) => {
                  const fromName = t.from === currentUserId ? "You" : (memberNameMap[t.from] ?? "Unknown");
                  const toName = t.to === currentUserId ? "you" : (memberNameMap[t.to] ?? "Unknown");
                  const involvesMe = t.from === currentUserId || t.to === currentUserId;
                  return (
                    <Card key={i} className={cn("py-4", involvesMe && "border-emerald-200 dark:border-emerald-800")}>
                      <CardContent className="py-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm">
                            <span className="font-medium">{fromName}</span>
                            {" pays "}
                            <span className="font-medium">{toName}</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <AmountDisplay
                              amount={t.amount}
                              currency={group.currency}
                              className="text-base font-bold"
                            />
                            <Button
                              size="sm"
                              onClick={() => openSettleDialog(t.from, t.to, t.amount)}
                            >
                              Settle
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-3">
          {activities.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </CardContent>
            </Card>
          ) : (
            activities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className={cn(
                  "mt-1 h-2 w-2 rounded-full shrink-0",
                  activity.type === "expense" ? "bg-emerald-500" : "bg-green-500"
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.date, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settle-up Dialog */}
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
    </div>
  );
}
