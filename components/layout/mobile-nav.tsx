"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Plus, Receipt, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "@/components/quick-add-expense";

type NavItem =
  | { label: string; path: string; icon: typeof LayoutDashboard; isCenter?: false }
  | { label: string; path: null; icon: typeof LayoutDashboard; isCenter: true };

const navItems: NavItem[] = [
  { label: "Home", path: "/", icon: LayoutDashboard },
  { label: "Groups", path: "/groups", icon: Users },
  { label: "Add", path: null, icon: Plus, isCenter: true },
  { label: "Expenses", path: "/expenses", icon: Receipt },
  { label: "Settle", path: "/settlements", icon: HandCoins },
];

export function MobileNav() {
  const pathname = usePathname();
  const { open } = useQuickAdd();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-around px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          if (item.isCenter) {
            return (
              <button
                key="add"
                type="button"
                onClick={() => open()}
                aria-label="Add expense"
                className="flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1"
              >
                <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-background transition-transform active:scale-[0.95] dark:bg-emerald-600">
                  <item.icon className="h-7 w-7" />
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
              </button>
            );
          }

          const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors",
                isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-6 w-6" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
