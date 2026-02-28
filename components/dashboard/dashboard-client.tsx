"use client";

import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  ChevronRight,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { DashboardData } from "@/actions/dashboard";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CategoryBadge } from "@/components/ui/category-badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface DashboardClientProps {
  data: DashboardData;
  currentUserId: string;
}

export function DashboardClient({ data, currentUserId }: DashboardClientProps) {
  const netBalance = data.youAreOwed - data.youOwe;

  return (
    <div className="space-y-8">
      {/* Balance summary — 3 cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* You Owe */}
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30">
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-100 p-2.5 dark:bg-orange-900/50">
                <ArrowUpRight className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You owe</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400">
                  {formatCurrency(data.youOwe)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Owed to You */}
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-900/50">
                <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owed to you</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(data.youAreOwed)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card
          className={
            netBalance >= 0
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
              : "border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30"
          }
        >
          <CardContent>
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  netBalance >= 0
                    ? "bg-emerald-100 dark:bg-emerald-900/50"
                    : "bg-orange-100 dark:bg-orange-900/50"
                }`}
              >
                <Scale
                  className={`h-5 w-5 ${
                    netBalance >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net balance</p>
                <p
                  className={`text-2xl font-bold font-mono tabular-nums ${
                    netBalance > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : netBalance < 0
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {netBalance > 0 && "+"}
                  {formatCurrency(Math.abs(netBalance))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Groups</h2>
          <Link href="/groups" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            View all
          </Link>
        </div>

        {data.groupSummaries.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-1">No groups yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first group to start splitting expenses
              </p>
              <Link
                href="/groups"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Create a group
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.groupSummaries.map((group) => {
              const groupNet = group.balances.reduce((sum, b) => sum + b.amount, 0);
              return (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                    <CardContent>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold truncate">{group.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <AvatarStack names={group.memberNames} max={3} size="sm" />
                            <span className="text-xs text-muted-foreground">
                              {group.memberNames.length} member{group.memberNames.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            {Math.abs(groupNet) < 0.01 ? (
                              <span className="text-sm text-muted-foreground">All settled up</span>
                            ) : (
                              <span
                                className={`text-sm font-semibold font-mono tabular-nums ${
                                  groupNet > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-orange-600 dark:text-orange-400"
                                }`}
                              >
                                {groupNet > 0 ? "+" : "-"}
                                {formatCurrency(Math.abs(groupNet), group.currency)}
                              </span>
                            )}
                            {group.lastActivity && (
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(group.lastActivity), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent expenses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Expenses</h2>
          <Link href="/expenses" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            View all
          </Link>
        </div>

        <Card>
          <CardContent>
            {data.recentExpenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses yet
              </p>
            ) : (
              <div className="space-y-4">
                {data.recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3"
                  >
                    <CategoryBadge />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {expense.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {expense.payerId === currentUserId ? "You" : expense.payerName} paid
                        {" · "}
                        {expense.groupName}
                        {" · "}
                        {format(new Date(expense.expenseDate), "MMM d")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold font-mono tabular-nums">
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
