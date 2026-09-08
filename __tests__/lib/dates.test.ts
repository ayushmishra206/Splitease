import { describe, it, expect } from "vitest";
import { dateOnlyToLocal, dateOnlyKey, formatDateOnly, isValidIsoDate, todayIso } from "@/lib/dates";

describe("dateOnlyToLocal", () => {
  it("keeps the calendar day of a UTC-midnight Date regardless of timezone", () => {
    // Prisma returns @db.Date columns as UTC midnight
    const stored = new Date("2026-03-01T00:00:00.000Z");
    const local = dateOnlyToLocal(stored);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(2);
    expect(local.getDate()).toBe(1);
  });

  it("parses yyyy-MM-dd strings", () => {
    const local = dateOnlyToLocal("2025-12-31");
    expect(local.getFullYear()).toBe(2025);
    expect(local.getMonth()).toBe(11);
    expect(local.getDate()).toBe(31);
  });
});

describe("dateOnlyKey / formatDateOnly", () => {
  it("round-trips a stored date to its key", () => {
    expect(dateOnlyKey(new Date("2026-09-08T00:00:00.000Z"))).toBe("2026-09-08");
    expect(dateOnlyKey("2026-09-08")).toBe("2026-09-08");
  });

  it("formats with the default pattern", () => {
    expect(formatDateOnly("2026-09-08")).toBe("Sep 8, 2026");
    expect(formatDateOnly(new Date("2026-01-15T00:00:00.000Z"), "MMM d")).toBe("Jan 15");
  });
});

describe("isValidIsoDate", () => {
  it("accepts real dates", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2026-09-08")).toBe(true);
  });

  it("rejects impossible or malformed dates", () => {
    expect(isValidIsoDate("2023-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-00-10")).toBe(false);
    expect(isValidIsoDate("08/09/2026")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("todayIso", () => {
  it("returns a yyyy-MM-dd string for today", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidIsoDate(todayIso())).toBe(true);
  });
});
