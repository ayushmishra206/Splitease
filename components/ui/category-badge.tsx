import { cn } from "@/lib/utils";
import { getCategoryEmoji } from "@/lib/categories";

interface CategoryBadgeProps {
  category?: string;
  size?: "sm" | "md";
  className?: string;
}

const BADGE_BG: Record<string, string> = {
  food: "bg-orange-100 dark:bg-orange-900/30",
  rent: "bg-blue-100 dark:bg-blue-900/30",
  transport: "bg-yellow-100 dark:bg-yellow-900/30",
  entertainment: "bg-purple-100 dark:bg-purple-900/30",
  groceries: "bg-green-100 dark:bg-green-900/30",
  travel: "bg-teal-100 dark:bg-teal-900/30",
  utilities: "bg-amber-100 dark:bg-amber-900/30",
  other: "bg-gray-100 dark:bg-gray-900/30",
};

export function CategoryBadge({ category, size = "sm", className }: CategoryBadgeProps) {
  const emoji = getCategoryEmoji(category);
  const bg = BADGE_BG[category ?? "other"] ?? BADGE_BG.other;
  const sizeClasses = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl shrink-0",
        sizeClasses,
        bg,
        className
      )}
    >
      {emoji}
    </div>
  );
}
