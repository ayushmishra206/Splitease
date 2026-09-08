"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, Scale, ChevronRight, Users, Plus } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/dates";
import type { DashboardData } from "@/actions/dashboard";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "@/components/quick-add-expense";

interface DashboardClientProps {
  data: DashboardData;
  currentUserId: string;
}

export function DashboardClient({ data, currentUserId }: DashboardClientProps) {
  const { open: openQuickAdd } = useQuickAdd();
  const netBalance = data.youAreOwed - data.youOwe;
  const currency = data.primaryCurrency;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Balance summary */}
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Card className="gap-0 border-orange-200 bg-orange-50 py-4 dark:border-orange-900/50 dark:bg-orange-950/30">
            <CardContent className="px-4">
              <div className="flex items-center gap-3">
                <div className="hidden rounded-xl bg-orange-100 p-2.5 sm:block dark:bg-orange-900/50">
                  <ArrowUpRight className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground sm:text-sm">You owe</p>
                  <p className="truncate font-mono text-xl font-bold tabular-nums text-orange-600 sm:text-2xl dark:text-orange-400">
                    {formatCurrency(data.youOwe, currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-emerald-200 bg-emerald-50 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <CardContent className="px-4">
              <div className="flex items-center gap-3">
                <div className="hidden rounded-xl bg-emerald-100 p-2.5 sm:block dark:bg-emerald-900/50">
                  <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground sm:text-sm">Owed to you</p>
                  <p className="truncate font-mono text-xl font-bold tabular-nums text-emerald-600 sm:text-2xl dark:text-emerald-400">
                    {formatCurrency(data.youAreOwed, currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "col-span-2 gap-0 py-4 sm:col-span-1",
              netBalance >= 0
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                : "border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30"
            )}
          >
            <CardContent className="px-4">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-xl p-2.5", netBalance >= 0 ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-orange-100 dark:bg-orange-900/50")}>
                  <Scale className={cn("h-5 w-5", netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400")} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground sm:text-sm">Net balance</p>
                  <p
                    className={cn(
                      "truncate font-mono text-xl font-bold tabular-nums sm:text-2xl",
                      netBalance > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : netBalance < 0
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {netBalance > 0 && "+"}
                    {netBalance < 0 && "-"}
                    {formatCurrency(Math.abs(netBalance), currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {data.mixedCurrencies && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your groups use different currencies. Totals above add amounts as-is in {currency}; open a group for exact figures.
          </p>
        )}
      </div>

      {/* Groups */}
      <div>
        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <h2 className="text-lg font-semibold">Your groups</h2>
          <Link href="/groups" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            View all
          </Link>
        </div>

        {data.groupSummaries.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="mb-1 text-lg font-medium">No groups yet</p>
              <p className="mb-4 text-sm text-muted-foreground">Create your first group to start splitting expenses</p>
              <Button asChild>
                <Link href="/groups">Create a group</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {data.groupSummaries.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="block">
                <Card className="cursor-pointer gap-0 py-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="px-4 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <h3 className="truncate font-semibold">{group.name}</h3>
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                          <AvatarStack names={group.memberNames} max={3} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {group.memberNames.length} member{group.memberNames.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Total spent</p>
                            <p className="font-mono font-semibold tabular-nums">
                              {formatCurrency(group.totalExpenses, group.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Your share</p>
                            <p className="font-mono font-semibold tabular-nums">
                              {formatCurrency(group.yourShare, group.currency)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          {Math.abs(group.netBalance) < 0.01 ? (
                            <span className="text-sm text-muted-foreground">All settled up</span>
                          ) : (
                            <span
                              className={cn(
                                "font-mono text-sm font-semibold tabular-nums",
                                group.netBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"
                              )}
                            >
                              {group.netBalance > 0 ? "You are owed " : "You owe "}
                              {formatCurrency(Math.abs(group.netBalance), group.currency)}
                            </span>
                          )}
                          {group.lastActivity && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(group.lastActivity), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent expenses */}
      <div>
        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <h2 className="text-lg font-semibold">Recent expenses</h2>
          <Link href="/expenses" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            View all
          </Link>
        </div>

        <Card className="py-4 sm:py-6">
          <CardContent className="px-4 sm:px-6">
            {data.recentExpenses.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No expenses yet</p>
                {data.totalGroups > 0 && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => openQuickAdd()}>
                    <Plus className="size-4" /> Add your first expense
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentExpenses.map((expense) => (
                  <Link key={expense.id} href={`/groups/${expense.groupId}`} className="flex items-center gap-3">
                    <CategoryBadge category={expense.category ?? undefined} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{expense.description}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {expense.payerId === currentUserId ? "You" : expense.payerName}
                        {expense.payerCount > 1 ? ` +${expense.payerCount - 1}` : ""} paid
                        {" · "}
                        {expense.groupName}
                        {" · "}
                        {formatDateOnly(expense.expenseDate, "MMM d")}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
