"use client";

import { useTheme } from "next-themes";
import { FiSun, FiMoon } from "react-icons/fi";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      className="w-full justify-center gap-2"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? (
        <FiSun className="h-4 w-4" />
      ) : (
        <FiMoon className="h-4 w-4" />
      )}
      <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
    </Button>
  );
}

export function ThemeToggleIcon() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={
        resolvedTheme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
    >
      {resolvedTheme === "dark" ? (
        <FiSun className="h-4 w-4" />
      ) : (
        <FiMoon className="h-4 w-4" />
      )}
    </button>
  );
}
