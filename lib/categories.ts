export type ExpenseCategory =
  | "food"
  | "rent"
  | "transport"
  | "entertainment"
  | "groceries"
  | "travel"
  | "utilities"
  | "other";

export const CATEGORIES: Record<
  ExpenseCategory,
  { emoji: string; label: string; color: string }
> = {
  food: { emoji: "🍔", label: "Food", color: "text-orange-500" },
  rent: { emoji: "🏠", label: "Rent", color: "text-blue-500" },
  transport: { emoji: "🚗", label: "Transport", color: "text-yellow-500" },
  entertainment: { emoji: "🎬", label: "Entertainment", color: "text-purple-500" },
  groceries: { emoji: "🛒", label: "Groceries", color: "text-green-500" },
  travel: { emoji: "✈️", label: "Travel", color: "text-teal-500" },
  utilities: { emoji: "💡", label: "Utilities", color: "text-amber-500" },
  other: { emoji: "📦", label: "Other", color: "text-gray-500" },
};

export const DEFAULT_CATEGORY: ExpenseCategory = "other";

export function getCategoryEmoji(category?: string): string {
  if (!category || !(category in CATEGORIES)) return CATEGORIES.other.emoji;
  return CATEGORIES[category as ExpenseCategory].emoji;
}

export function getCategoryColor(category?: string): string {
  if (!category || !(category in CATEGORIES)) return CATEGORIES.other.color;
  return CATEGORIES[category as ExpenseCategory].color;
}
