import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted so vi.mock factories can reference them) ────────────────

const { mockPrisma, mockSignIn, mockHeaders } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    rateLimitAttempt: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  },
  mockSignIn: vi.fn(),
  mockHeaders: vi.fn(() => new Map([
    ["x-forwarded-for", "192.168.1.1"],
  ])),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error { constructor(m?: string) { super(m); this.name = "AuthError"; } },
}));
vi.mock("@/auth", () => ({
  signIn: mockSignIn,
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(() => ({ id: "user-1", email: "test@test.com", name: "Test" })),
}));
vi.mock("@/lib/email/send", () => ({ sendEmailSafe: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ welcomeEmail: vi.fn(() => "<html>welcome</html>") }));
vi.mock("next/headers", () => ({ headers: mockHeaders }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { signIn, signUp, changePassword } from "@/actions/auth";
import { AuthError } from "next-auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

// ── signIn ──────────────────────────────────────────────────────────────────

describe("signIn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when email or password is missing", async () => {
    const result = await signIn(makeFormData({ email: "", password: "" }));
    expect(result).toEqual({ error: "Email and password are required" });
  });

  it("returns rate limit error after too many attempts", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(5);

    const result = await signIn(makeFormData({ email: "test@test.com", password: "abc123" }));
    expect(result).toEqual({ error: "Too many login attempts. Please try again later." });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("allows login when under rate limit", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(4);
    const redirectError = new Error("NEXT_REDIRECT");
    (redirectError as unknown as Record<string, string>).digest = "NEXT_REDIRECT";
    mockSignIn.mockRejectedValue(redirectError);

    try {
      await signIn(makeFormData({ email: "test@test.com", password: "abc123" }));
    } catch {
      // Next.js redirect throws — expected
    }

    expect(mockSignIn).toHaveBeenCalledOnce();
  });

  it("records failed attempt on wrong credentials", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
    mockSignIn.mockRejectedValue(new AuthError("CredentialsSignin"));

    const result = await signIn(makeFormData({ email: "test@test.com", password: "wrong" }));
    expect(result).toEqual({ error: "Invalid email or password" });
    expect(mockPrisma.rateLimitAttempt.create).toHaveBeenCalledWith({
      data: { email: "test@test.com", ipAddress: "192.168.1.1", type: "login" },
    });
  });

  it("does not record attempt on successful login", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
    const redirectError = new Error("NEXT_REDIRECT");
    (redirectError as unknown as Record<string, string>).digest = "NEXT_REDIRECT";
    mockSignIn.mockRejectedValue(redirectError);

    try {
      await signIn(makeFormData({ email: "test@test.com", password: "abc123" }));
    } catch {
      // redirect
    }

    expect(mockPrisma.rateLimitAttempt.create).not.toHaveBeenCalled();
  });

  it("cleans up stale rate limit records", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
    mockSignIn.mockRejectedValue(new AuthError("CredentialsSignin"));

    await signIn(makeFormData({ email: "test@test.com", password: "wrong" }));

    // deleteMany should have been called for stale cleanup
    expect(mockPrisma.rateLimitAttempt.deleteMany).toHaveBeenCalled();
  });
});

// ── signUp ─────────────────────────────────────────────────────────────────

describe("signUp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when fields are missing", async () => {
    const result = await signUp(makeFormData({ email: "", password: "", fullName: "" }));
    expect(result).toEqual({ error: "All fields are required" });
  });

  it("returns error when password is too short", async () => {
    const result = await signUp(makeFormData({ email: "a@b.com", password: "abc", fullName: "Bob" }));
    expect(result).toEqual({ error: "Password must be at least 6 characters" });
  });

  it("returns rate limit error after too many signup attempts", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(3);

    const result = await signUp(makeFormData({ email: "new@user.com", password: "abc123", fullName: "New" }));
    expect(result).toEqual({ error: "Too many signup attempts. Please try again later." });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("records signup attempt even when successful", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "u2" });

    const redirectError = new Error("NEXT_REDIRECT");
    (redirectError as unknown as Record<string, string>).digest = "NEXT_REDIRECT";
    mockSignIn.mockRejectedValue(redirectError);

    try {
      await signUp(makeFormData({ email: "new@user.com", password: "abc123", fullName: "New User" }));
    } catch {
      // redirect
    }

    expect(mockPrisma.rateLimitAttempt.create).toHaveBeenCalledWith({
      data: { email: "new@user.com", ipAddress: "192.168.1.1", type: "signup" },
    });
  });

  it("returns error when email already exists", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com" });
    const result = await signUp(makeFormData({ email: "a@b.com", password: "abc123", fullName: "Bob" }));
    expect(result).toEqual({ error: "An account with this email already exists" });
  });

  it("creates user with hashed password and authProvider on valid input", async () => {
    mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "u2" });

    // signIn redirects which throws in Next.js
    const redirectError = new Error("NEXT_REDIRECT");
    (redirectError as unknown as Record<string, string>).digest = "NEXT_REDIRECT";
    mockSignIn.mockRejectedValue(redirectError);

    try {
      await signUp(makeFormData({ email: "new@user.com", password: "abc123", fullName: "New User" }));
    } catch {
      // Next.js redirect throws — expected
    }

    expect(mockPrisma.user.create).toHaveBeenCalledOnce();
    const createData = mockPrisma.user.create.mock.calls[0][0].data;
    expect(createData.email).toBe("new@user.com");
    expect(createData.fullName).toBe("New User");
    expect(createData.authProvider).toBe("credentials");
    // Password should be hashed, not plain text
    expect(createData.password).not.toBe("abc123");
    expect(createData.password).toMatch(/^\$2[aby]\$/);
  });
});

// ── changePassword ─────────────────────────────────────────────────────────

describe("changePassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when new password is empty", async () => {
    const result = await changePassword(makeFormData({ currentPassword: "old", newPassword: "", confirmPassword: "" }));
    expect(result).toEqual({ error: "New password is required" });
  });

  it("returns error when new password is too short", async () => {
    const result = await changePassword(makeFormData({ currentPassword: "old", newPassword: "abc", confirmPassword: "abc" }));
    expect(result.error).toContain("at least 6 characters");
  });

  it("returns error when passwords don't match", async () => {
    const result = await changePassword(makeFormData({ currentPassword: "old", newPassword: "abc123", confirmPassword: "xyz789" }));
    expect(result.error).toContain("do not match");
  });

  it("returns error when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await changePassword(makeFormData({ currentPassword: "old", newPassword: "abc123", confirmPassword: "abc123" }));
    expect(result.error).toContain("User not found");
  });

  it("returns error when current password is wrong", async () => {
    // Use a real bcrypt hash for "correctpass"
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correctpass", 4);
    mockPrisma.user.findUnique.mockResolvedValue({ password: hash });

    const result = await changePassword(makeFormData({ currentPassword: "wrongpass", newPassword: "abc123", confirmPassword: "abc123" }));
    expect(result.error).toContain("Current password is incorrect");
  });

  it("allows OAuth user to set password without current password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ password: null });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await changePassword(makeFormData({ currentPassword: "", newPassword: "newpass123", confirmPassword: "newpass123" }));
    expect(result.success).toContain("Password changed successfully");
    expect(mockPrisma.user.update).toHaveBeenCalledOnce();
    // Password should be bcrypt-hashed
    const updatedData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updatedData.password).toMatch(/^\$2[aby]\$/);
  });

  it("sets passwordChangedAt when changing password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ password: null });
    mockPrisma.user.update.mockResolvedValue({});

    await changePassword(makeFormData({ currentPassword: "", newPassword: "newpass123", confirmPassword: "newpass123" }));

    const updatedData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updatedData.passwordChangedAt).toBeInstanceOf(Date);
  });

  it("requires current password when user has one", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("existing", 4);
    mockPrisma.user.findUnique.mockResolvedValue({ password: hash });

    const result = await changePassword(makeFormData({ currentPassword: "", newPassword: "abc123", confirmPassword: "abc123" }));
    expect(result.error).toContain("Current password is required");
  });

  it("changes password when current password is correct", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("oldpass", 4);
    mockPrisma.user.findUnique.mockResolvedValue({ password: hash });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await changePassword(makeFormData({ currentPassword: "oldpass", newPassword: "newpass123", confirmPassword: "newpass123" }));
    expect(result.success).toContain("Password changed successfully");
    expect(mockPrisma.user.update).toHaveBeenCalledOnce();
  });
});
