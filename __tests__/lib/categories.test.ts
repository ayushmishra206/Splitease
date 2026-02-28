import { describe, it, expect } from "vitest";
import {
  getCategoryEmoji,
  getCategoryColor,
  CATEGORIES,
  DEFAULT_CATEGORY,
} from "@/lib/categories";

describe("CATEGORIES", () => {
  it("has 8 categories", () => {
    expect(Object.keys(CATEGORIES)).toHaveLength(8);
  });

  it("each category has emoji, label, and color", () => {
    for (const [key, value] of Object.entries(CATEGORIES)) {
      expect(value.emoji).toBeTruthy();
      expect(value.label).toBeTruthy();
      expect(value.color).toBeTruthy();
    }
  });
});

describe("DEFAULT_CATEGORY", () => {
  it("is 'other'", () => {
    expect(DEFAULT_CATEGORY).toBe("other");
  });
});

describe("getCategoryEmoji", () => {
  it("returns correct emoji for each category", () => {
    expect(getCategoryEmoji("food")).toBe("\u{1F354}");
    expect(getCategoryEmoji("rent")).toBe("\u{1F3E0}");
    expect(getCategoryEmoji("transport")).toBe("\u{1F697}");
    expect(getCategoryEmoji("entertainment")).toBe("\u{1F3AC}");
    expect(getCategoryEmoji("groceries")).toBe("\u{1F6D2}");
    expect(getCategoryEmoji("travel")).toBe("\u2708\uFE0F");
    expect(getCategoryEmoji("utilities")).toBe("\u{1F4A1}");
    expect(getCategoryEmoji("other")).toBe("\u{1F4E6}");
  });

  it("returns other emoji for unknown category", () => {
    expect(getCategoryEmoji("nonexistent")).toBe("\u{1F4E6}");
  });

  it("returns other emoji for undefined", () => {
    expect(getCategoryEmoji(undefined)).toBe("\u{1F4E6}");
  });

  it("returns other emoji for empty string", () => {
    expect(getCategoryEmoji("")).toBe("\u{1F4E6}");
  });
});

describe("getCategoryColor", () => {
  it("returns correct color for food", () => {
    expect(getCategoryColor("food")).toBe("text-orange-500");
  });

  it("returns correct color for rent", () => {
    expect(getCategoryColor("rent")).toBe("text-blue-500");
  });

  it("returns other color for unknown", () => {
    expect(getCategoryColor("nonexistent")).toBe("text-gray-500");
  });

  it("returns other color for undefined", () => {
    expect(getCategoryColor(undefined)).toBe("text-gray-500");
  });
});
