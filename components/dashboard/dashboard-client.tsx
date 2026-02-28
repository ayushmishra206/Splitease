"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  HandCoins,
  Receipt,
  TrendingUp,
  Users,
  User,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { DashboardData } from "@/actions/dashboard";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardClientProps {
  data: DashboardData;
  currentUserId: string;
}

export function DashboardClient({ data, currentUserId }: DashboardClientProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/50">
                <Users className="size-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Groups</p>
                <p className="text-2xl font-semibold">{data.totalGroups}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/50">
                <Receipt className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-2xl font-semibold">{data.totalExpenses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/50">
                <ArrowUp className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You owe</p>
                <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(data.youOwe)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/50">
                <ArrowDown className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You are owed</p>
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(data.youAreOwed)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent expenses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Expenses</CardTitle>
                <CardDescription>Last 5 expenses across all groups</CardDescription>
              </div>
              <Link
                href="/expenses"
                className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentExpenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses yet
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {expense.payerId === currentUserId
                            ? "You"
                            : expense.payerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {format(new Date(expense.expenseDate), "MMM d")}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {expense.groupName}
                        </Badge>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        expense.payerId === currentUserId
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ""
                      }`}
                    >
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group balances */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Group Balances</CardTitle>
                <CardDescription>Your net balance per group</CardDescription>
              </div>
              <Link
                href="/settlements"
                className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Settle up
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.groupSummaries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No groups yet
              </p>
            ) : (
              <div className="space-y-4">
                {data.groupSummaries.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{group.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        <TrendingUp className="mr-1 inline size-3" />
                        {formatCurrency(group.totalExpenses, group.currency)} total
                      </span>
                    </div>
                    {group.balances.length === 0 ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HandCoins className="size-3" />
                        All settled up
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {group.balances.map((b) => (
                          <div
                            key={b.memberId}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {b.memberName}
                            </span>
                            <span
                              className={
                                b.amount > 0
                                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                                  : "font-medium text-red-600 dark:text-red-400"
                              }
                            >
                              {b.amount > 0 ? "owes you " : "you owe "}
                              {formatCurrency(Math.abs(b.amount), group.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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
