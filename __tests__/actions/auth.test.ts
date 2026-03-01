import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted so vi.mock factories can reference them) ────────────────

const { mockPrisma, mockSignIn } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  mockSignIn: vi.fn(),
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

import { signUp, changePassword } from "@/actions/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

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

  it("returns error when email already exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com" });
    const result = await signUp(makeFormData({ email: "a@b.com", password: "abc123", fullName: "Bob" }));
    expect(result).toEqual({ error: "An account with this email already exists" });
  });

  it("creates user with hashed password on valid input", async () => {
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
    const updatedPassword = mockPrisma.user.update.mock.calls[0][0].data.password;
    expect(updatedPassword).toMatch(/^\$2[aby]\$/);
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
