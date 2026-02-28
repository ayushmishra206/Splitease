"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { GroupDetailData } from "@/actions/group-detail";
import { AmountDisplay } from "@/components/ui/amount-display";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const [activeTab, setActiveTab] = useState<TabId>("expenses");
  const [copied, setCopied] = useState(false);
  const { group, members, expenses, settlements } = data;

  const memberNames = members.map((m) => m.fullName);

  function handleCopyInvite() {
    const url = `${window.location.origin}/groups?join=${group.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  // Compute simplified balances
  const net: Record<string, number> = {};
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (expense.payerId === currentUserId && split.memberId !== currentUserId) {
        net[split.memberId] = (net[split.memberId] ?? 0) + split.share;
      } else if (expense.payerId !== currentUserId && split.memberId === currentUserId) {
        net[expense.payerId] = (net[expense.payerId] ?? 0) - split.share;
      }
    }
  }
  for (const s of settlements) {
    if (s.fromMember === currentUserId) {
      net[s.toMember] = (net[s.toMember] ?? 0) + s.amount;
    } else if (s.toMember === currentUserId) {
      net[s.fromMember] = (net[s.fromMember] ?? 0) - s.amount;
    }
  }
  const balanceList = Object.entries(net)
    .filter(([, amount]) => Math.abs(amount) > 0.01)
    .map(([memberId, amount]) => ({
      memberId,
      memberName: members.find((m) => m.id === memberId)?.fullName ?? "Unknown",
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

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
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
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
                            <CategoryBadge />
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
                                  iPaid ? "text-success" : "text-destructive"
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
        <div className="space-y-3">
          {balanceList.length === 0 ? (
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
            balanceList.map((b) => (
              <Card key={b.memberId} className="py-4">
                <CardContent className="py-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.memberName}</p>
                      <p className={cn(
                        "text-xs",
                        b.amount > 0 ? "text-success" : "text-destructive"
                      )}>
                        {b.amount > 0 ? "owes you" : "you owe"}
                      </p>
                    </div>
                    <AmountDisplay
                      amount={b.amount}
                      currency={group.currency}
                      className="text-base font-bold"
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
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
                  activity.type === "expense" ? "bg-primary" : "bg-success"
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
    </div>
  );
}
