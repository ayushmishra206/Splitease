"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiPlus, FiLogOut } from "react-icons/fi";
import { ThemeToggleIcon } from "@/components/layout/theme-toggle";
import { signOut } from "@/actions/auth";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/groups": "Groups",
  "/expenses": "Expenses",
  "/settlements": "Settlements",
  "/settings": "Settings",
};

interface HeaderProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
  };
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const title = titleMap[pathname] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
            {new Date().toLocaleDateString()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h1>
        </div>

        {/* Desktop */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/expenses?create=true"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
          >
            <FiPlus className="h-4 w-4" /> Quick add expense
          </Link>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white">
              {user.email?.slice(0, 1).toUpperCase() ?? "U"}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {user.user_metadata?.full_name ?? "You"}
              </p>
              <p className="text-slate-500 dark:text-slate-300">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/expenses?create=true"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500"
          >
            <FiPlus className="h-4 w-4" /> Add
          </Link>
          <ThemeToggleIcon />
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-800/80 dark:bg-rose-900/40 dark:text-rose-200 dark:hover:border-rose-700"
            >
              <FiLogOut className="h-4 w-4" />
            </button>
          </form>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {user.email?.slice(0, 1).toUpperCase() ?? "U"}
          </div>
        </div>
      </div>
    </header>
  );
}
