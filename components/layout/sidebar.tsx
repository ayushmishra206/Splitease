"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiBarChart2,
  FiUsers,
  FiFileText,
  FiCheckCircle,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { signOut } from "@/actions/auth";

const navItems = [
  { label: "Dashboard", path: "/", icon: FiBarChart2 },
  { label: "Groups", path: "/groups", icon: FiUsers },
  { label: "Expenses", path: "/expenses", icon: FiFileText },
  { label: "Settlements", path: "/settlements", icon: FiCheckCircle },
  { label: "Settings", path: "/settings", icon: FiSettings },
];

interface SidebarProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-72 md:flex-col md:border-r md:border-slate-200 md:bg-white/90 md:shadow-2xl md:backdrop-blur dark:md:border-slate-800 dark:md:bg-slate-950/80">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-6 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <span className="text-lg font-semibold">SE</span>
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              SplitEase
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Split expenses, not friendships.
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          {navItems.map(({ label, path, icon: Icon }) => {
            const isActive =
              path === "/" ? pathname === "/" : pathname.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200 px-6 py-6 dark:border-slate-800">
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-800/80 dark:bg-rose-900/40 dark:text-rose-200 dark:hover:border-rose-700"
            >
              <FiLogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
