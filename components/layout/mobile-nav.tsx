"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Plus, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", path: "/", icon: LayoutDashboard },
  { label: "Groups", path: "/groups", icon: Users },
  { label: "Add", path: "/expenses?create=true", icon: Plus, isCenter: true },
  { label: "Expenses", path: "/expenses", icon: Receipt },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {navItems.map(({ label, path, icon: Icon, isCenter }) => {
          const isActive = !isCenter && (path === "/" ? pathname === "/" : pathname.startsWith(path));

          if (isCenter) {
            return (
              <Link
                key="add"
                href={path}
                className="flex flex-col items-center gap-0.5"
              >
                <div className="flex h-12 w-12 -mt-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-[0.97] transition-transform">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
