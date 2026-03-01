import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted so vi.mock factories can reference them) ────────────────

const { mockPrisma, mockSendEmail } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((args: unknown[]) => Promise.all(args)),
  },
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email/send", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email/templates", () => ({
  passwordResetEmail: vi.fn(() => "<html>reset</html>"),
}));
vi.mock("crypto", () => ({
  default: { randomBytes: () => ({ toString: () => "mock-token-abc123" }) },
}));

import { requestPasswordReset, resetPassword } from "@/actions/password-reset";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

// ── requestPasswordReset ───────────────────────────────────────────────────

describe("requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when email is empty", async () => {
    const result = await requestPasswordReset(makeFormData({ email: "" }));
    expect(result).toEqual({ error: "Email is required" });
  });

  it("returns success for non-existent user (no info leak)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await requestPasswordReset(makeFormData({ email: "no@one.com" }));
    expect(result.success).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it("returns rate limit error when too many requests", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1", fullName: "Alice", email: "a@b.com",
    });
    mockPrisma.passwordResetToken.count.mockResolvedValue(3);

    const result = await requestPasswordReset(makeFormData({ email: "a@b.com" }));
    expect(result.error).toContain("Too many reset requests");
  });

  it("creates token and sends email on valid request", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1", fullName: "Alice", email: "a@b.com",
    });
    mockPrisma.passwordResetToken.count.mockResolvedValue(0);
    mockPrisma.passwordResetToken.create.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    const result = await requestPasswordReset(makeFormData({ email: "A@B.com " }));
    expect(result.success).toBeTruthy();
    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("trims and lowercases email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await requestPasswordReset(makeFormData({ email: "  Alice@GMAIL.COM  " }));
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "alice@gmail.com" },
      select: { id: true, fullName: true, email: true },
    });
  });

  it("returns error when email send fails", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1", fullName: "Alice", email: "a@b.com",
    });
    mockPrisma.passwordResetToken.count.mockResolvedValue(0);
    mockPrisma.passwordResetToken.create.mockResolvedValue({});
    mockSendEmail.mockRejectedValue(new Error("SMTP failure"));

    const result = await requestPasswordReset(makeFormData({ email: "a@b.com" }));
    expect(result.error).toContain("Failed to send email");
  });
});

// ── resetPassword ──────────────────────────────────────────────────────────

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when token is missing", async () => {
    const result = await resetPassword(makeFormData({ token: "", password: "abc123", confirmPassword: "abc123" }));
    expect(result.error).toContain("Invalid reset link");
  });

  it("returns error when password is too short", async () => {
    const result = await resetPassword(makeFormData({ token: "tok", password: "abc", confirmPassword: "abc" }));
    expect(result.error).toContain("at least 6 characters");
  });

  it("returns error when passwords don't match", async () => {
    const result = await resetPassword(makeFormData({ token: "tok", password: "abc123", confirmPassword: "xyz789" }));
    expect(result.error).toContain("do not match");
  });

  it("returns error for invalid token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    const result = await resetPassword(makeFormData({ token: "bad", password: "abc123", confirmPassword: "abc123" }));
    expect(result.error).toContain("Invalid or expired");
  });

  it("returns error for already-used token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1", userId: "u1", expiresAt: new Date(Date.now() + 60000), usedAt: new Date(),
    });
    const result = await resetPassword(makeFormData({ token: "used", password: "abc123", confirmPassword: "abc123" }));
    expect(result.error).toContain("already been used");
  });

  it("returns error for expired token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1", userId: "u1", expiresAt: new Date(Date.now() - 60000), usedAt: null,
    });
    const result = await resetPassword(makeFormData({ token: "expired", password: "abc123", confirmPassword: "abc123" }));
    expect(result.error).toContain("expired");
  });

  it("resets password on valid token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1", userId: "u1", expiresAt: new Date(Date.now() + 60000), usedAt: null,
    });
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await resetPassword(makeFormData({ token: "good", password: "newpass123", confirmPassword: "newpass123" }));
    expect(result.success).toContain("Password reset successfully");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});
