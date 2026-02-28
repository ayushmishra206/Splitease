"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiBarChart2,
  FiUsers,
  FiFileText,
  FiCheckCircle,
  FiSettings,
} from "react-icons/fi";

const navItems = [
  { label: "Dashboard", path: "/", icon: FiBarChart2 },
  { label: "Groups", path: "/groups", icon: FiUsers },
  { label: "Expenses", path: "/expenses", icon: FiFileText },
  { label: "Settlements", path: "/settlements", icon: FiCheckCircle },
  { label: "Settings", path: "/settings", icon: FiSettings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-3">
        {navItems.map(({ label, path, icon: Icon }) => {
          const isActive =
            path === "/" ? pathname === "/" : pathname.startsWith(path);
          return (
            <Link
              key={path}
              href={path}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
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
