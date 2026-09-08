"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Settings, UserPen, LogOut, Sun, Moon, BarChart3 } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuickAdd } from "@/components/quick-add-expense";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/groups": "Groups",
  "/expenses": "Expenses",
  "/settlements": "Settlements",
  "/settings": "Settings",
  "/analytics": "Analytics",
};

interface HeaderProps {
  user: {
    id: string;
    email?: string;
    name?: string;
  };
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { open } = useQuickAdd();

  const title = pathname.startsWith("/groups/")
    ? "Group"
    : titleMap[pathname] ?? "Dashboard";

  const displayName = user.name ?? user.email?.split("@")[0] ?? "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-lg font-semibold sm:text-xl">{title}</h1>

        {/* Desktop: Add Expense CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Button onClick={() => open()}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>

        {/* Mobile: user menu */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-600 transition-all data-[state=open]:ring-2 data-[state=open]:ring-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{displayName}</p>
                {user.email && (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-lg py-2.5">
                <Link href="/analytics">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg py-2.5">
                <Link href="/settings#profile">
                  <UserPen className="h-4 w-4" />
                  Edit Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg py-2.5">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-lg py-2.5"
                onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="rounded-lg py-2.5"
                onSelect={() => {
                  void signOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
