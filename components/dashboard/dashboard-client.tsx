"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  ChevronRight,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import type { DashboardData } from "@/actions/dashboard";
import { AmountDisplay } from "@/components/ui/amount-display";
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
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5">
                <ArrowUpRight className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You owe</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-accent">
                  {formatCurrency(data.youOwe)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Owed to You */}
        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-success/10 p-2.5">
                <ArrowDownLeft className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owed to you</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-success">
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
              ? "border-primary/20 bg-primary/5"
              : "border-accent/20 bg-accent/5"
          }
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  netBalance >= 0 ? "bg-primary/10" : "bg-accent/10"
                }`}
              >
                <Scale
                  className={`h-5 w-5 ${
                    netBalance >= 0 ? "text-primary" : "text-accent"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net balance</p>
                <AmountDisplay
                  amount={netBalance}
                  showSign
                  className="text-2xl font-bold"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Groups</h2>
          <Link href="/groups" className="text-sm font-medium text-primary hover:underline">
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
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.97]"
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
                    <CardContent className="pt-6">
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
                              <AmountDisplay
                                amount={groupNet}
                                currency={group.currency}
                                showSign
                                className="text-sm font-semibold"
                              />
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
          <Link href="/expenses" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        <Card>
          <CardContent className="pt-6">
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
                    <AmountDisplay
                      amount={expense.amount}
                      currency={expense.currency}
                      className="text-sm font-semibold"
                    />
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
