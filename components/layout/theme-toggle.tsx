"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/lib/hooks/use-mounted";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      className={className ?? "w-full justify-center gap-2"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span>
        {mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
      </span>
    </Button>
  );
}
