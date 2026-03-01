import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  welcomeEmail,
  passwordResetEmail,
  addedToGroupEmail,
  expenseAddedEmail,
  settlementRecordedEmail,
} from "@/lib/email/templates";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.splitease.com");
});

describe("welcomeEmail", () => {
  it("includes the user's name", () => {
    const html = welcomeEmail("Alice");
    expect(html).toContain("Welcome, Alice!");
  });

  it("includes a link to the groups page", () => {
    const html = welcomeEmail("Bob");
    expect(html).toContain("https://app.splitease.com/groups");
    expect(html).toContain("Go to SplitEase");
  });

  it("is valid HTML with doctype", () => {
    const html = welcomeEmail("Test");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("includes SplitEase branding", () => {
    const html = welcomeEmail("Test");
    expect(html).toContain("SplitEase");
    expect(html).toContain("#10B981");
  });
});

describe("passwordResetEmail", () => {
  it("includes the user's name", () => {
    const html = passwordResetEmail("Alice", "https://example.com/reset?token=abc");
    expect(html).toContain("Hi Alice");
  });

  it("includes the reset URL", () => {
    const url = "https://app.splitease.com/reset-password?token=abc123";
    const html = passwordResetEmail("Bob", url);
    expect(html).toContain(url);
    expect(html).toContain("Reset Password");
  });

  it("mentions link expiry", () => {
    const html = passwordResetEmail("Test", "https://example.com/reset");
    expect(html).toContain("1 hour");
  });

  it("mentions safe to ignore", () => {
    const html = passwordResetEmail("Test", "https://example.com/reset");
    expect(html).toContain("safely ignore");
  });
});

describe("addedToGroupEmail", () => {
  it("includes member name and group name", () => {
    const html = addedToGroupEmail("Alice", "Trip to Goa", "Bob");
    expect(html).toContain("Hi Alice");
    expect(html).toContain("Trip to Goa");
  });

  it("includes the inviter name", () => {
    const html = addedToGroupEmail("Alice", "Trip to Goa", "Bob");
    expect(html).toContain("Bob");
  });

  it("includes a link to view the group", () => {
    const html = addedToGroupEmail("Alice", "Trip", "Bob");
    expect(html).toContain("https://app.splitease.com/groups");
    expect(html).toContain("View Group");
  });
});

describe("expenseAddedEmail", () => {
  it("includes all expense details", () => {
    const html = expenseAddedEmail("Alice", "Dinner", "50.00", "INR", "Weekend Trip", "Bob");
    expect(html).toContain("Hi Alice");
    expect(html).toContain("Dinner");
    expect(html).toContain("50.00 INR");
    expect(html).toContain("Weekend Trip");
    expect(html).toContain("Bob");
  });

  it("includes a view details link", () => {
    const html = expenseAddedEmail("Alice", "Lunch", "25.00", "USD", "Office", "Charlie");
    expect(html).toContain("View Details");
    expect(html).toContain("https://app.splitease.com/groups");
  });
});

describe("settlementRecordedEmail", () => {
  it("includes settlement details", () => {
    const html = settlementRecordedEmail("Alice", "100.00", "INR", "Flatmates", "Bob", "Alice");
    expect(html).toContain("Hi Alice");
    expect(html).toContain("100.00 INR");
    expect(html).toContain("Flatmates");
    expect(html).toContain("Bob");
    expect(html).toContain("Alice");
  });

  it("includes a view details link", () => {
    const html = settlementRecordedEmail("Test", "50.00", "USD", "Group", "A", "B");
    expect(html).toContain("View Details");
    expect(html).toContain("https://app.splitease.com/groups");
  });
});
