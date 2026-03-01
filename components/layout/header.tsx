"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Settings, UserPen, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const title = pathname.startsWith("/groups/")
    ? "Groups"
    : titleMap[pathname] ?? "Dashboard";

  const displayName = user.name ?? user.email?.split("@")[0] ?? "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold">{title}</h1>

        {/* Desktop: Add Expense CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button asChild>
            <Link href="/expenses?create=true">
              <Plus className="h-4 w-4" />
              Add Expense
            </Link>
          </Button>
        </div>

        {/* Mobile: User avatar button */}
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all",
              menuOpen
                ? "ring-2 ring-emerald-500 bg-emerald-100 text-emerald-700 dark:ring-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-300"
                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            )}
          >
            {initials}
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                {/* User info */}
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {user.email && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                </div>

                {/* Menu items */}
                <Link
                  href="/settings#profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <UserPen className="h-4 w-4" />
                  Edit Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                </button>

                <div className="my-1 border-t border-border" />

                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
