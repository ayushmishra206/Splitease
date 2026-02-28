"use client";

import { useState, useTransition } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, TrendingUp, PieChartIcon, Users, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAnalyticsData, type AnalyticsData } from "@/actions/analytics";
import { CATEGORIES, type ExpenseCategory } from "@/lib/categories";
import { formatCurrency } from "@/lib/utils";

const CHART_COLORS = [
  "#f97316",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#22c55e",
  "#14b8a6",
  "#f59e0b",
  "#6b7280",
];

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};

function formatMonthLabel(month: string): string {
  const parts = month.split("-");
  if (parts.length !== 2) return month;
  const monthNum = parts[1];
  return MONTH_LABELS[monthNum] ?? month;
}

interface AnalyticsClientProps {
  data: AnalyticsData;
  groups: Array<{ id: string; name: string }>;
}

export function AnalyticsClient({ data: initialData, groups }: AnalyticsClientProps) {
  const [data, setData] = useState<AnalyticsData>(initialData);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  function handleGroupChange(value: string) {
    setSelectedGroup(value);
    startTransition(async () => {
      const groupId = value === "all" ? undefined : value;
      const newData = await fetchAnalyticsData(groupId);
      setData(newData);
    });
  }

  const hasData =
    data.monthlySpending.length > 0 ||
    data.categoryBreakdown.length > 0 ||
    data.groupComparison.length > 0 ||
    data.topSpenders.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Insights into your spending patterns
            </p>
          </div>
          {groups.length > 0 && (
            <Select value={selectedGroup} onValueChange={handleGroupChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No expense data yet
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Add some expenses to see analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthlyData = data.monthlySpending.map((item) => ({
    ...item,
    label: formatMonthLabel(item.month),
  }));

  const categoryData = data.categoryBreakdown.map((item) => {
    const cat = CATEGORIES[item.category as ExpenseCategory];
    return {
      ...item,
      label: cat ? `${cat.emoji} ${cat.label}` : item.category,
      name: cat?.label ?? item.category,
    };
  });

  const totalSpending = data.categoryBreakdown.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Insights into your spending patterns
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPending && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Updating...
            </span>
          )}
          {groups.length > 0 && (
            <Select value={selectedGroup} onValueChange={handleGroupChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Spending */}
        {data.monthlySpending.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Monthly Spending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      className="text-xs"
                      tick={{ fill: "currentColor", fontSize: 12 }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      tickFormatter={(value: number) => formatCurrency(value).replace(".00", "")}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "0.875rem",
                      }}
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), "Total"]}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Breakdown */}
        {data.categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className="h-4 w-4 text-orange-500" />
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="total"
                      nameKey="name"
                    >
                      {categoryData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "0.875rem",
                      }}
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), "Spent"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {categoryData.map((item, index) => (
                  <div key={item.category} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground">{item.label}</span>
                    <span className="ml-auto font-medium tabular-nums">
                      {totalSpending > 0
                        ? `${Math.round((item.total / totalSpending) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Group Comparison */}
        {data.groupComparison.length > 0 && selectedGroup === "all" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-blue-500" />
                Group Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.groupComparison}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      type="number"
                      className="text-xs"
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      tickFormatter={(value: number) => formatCurrency(value).replace(".00", "")}
                    />
                    <YAxis
                      type="category"
                      dataKey="groupName"
                      className="text-xs"
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "0.875rem",
                      }}
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), "Total"]}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Spenders */}
        {data.topSpenders.length > 0 && (
          <Card className={data.groupComparison.length === 0 || selectedGroup !== "all" ? "lg:col-span-2" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top Spenders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topSpenders.map((spender, index) => (
                  <div
                    key={spender.userId}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {spender.userName}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(spender.total)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
