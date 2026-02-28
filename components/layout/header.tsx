"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/groups": "Groups",
  "/expenses": "Expenses",
  "/settings": "Settings",
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

  // For group detail pages, show "Groups" as title
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

        {/* Mobile: User avatar */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-semibold">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
