"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/auth";
import { AuthError } from "next-auth";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendEmailSafe } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SIGNUP_RATE_LIMIT = 3;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const STALE_ATTEMPT_MS = 24 * 60 * 60 * 1000; // 24 hours
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? h.get("x-real-ip")
    ?? "unknown";
}

async function checkRateLimit(
  email: string,
  ip: string,
  type: "login" | "signup",
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  // Clean up stale records older than 24 hours (fire-and-forget)
  prisma.rateLimitAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - STALE_ATTEMPT_MS) } },
  }).catch(() => {});

  // Rate limit by email OR IP independently to prevent bypasses:
  // - By email: prevents distributed brute-force from multiple IPs against one account
  // - By IP: prevents one IP from spraying attempts across multiple accounts
  const [emailCount, ipCount] = await Promise.all([
    prisma.rateLimitAttempt.count({
      where: { email, type, createdAt: { gte: windowStart } },
    }),
    prisma.rateLimitAttempt.count({
      where: { ipAddress: ip, type, createdAt: { gte: windowStart } },
    }),
  ]);

  return emailCount >= limit || ipCount >= limit;
}

async function recordAttempt(email: string, ip: string, type: "login" | "signup"): Promise<void> {
  await prisma.rateLimitAttempt.create({
    data: { email, ipAddress: ip, type },
  });
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const ip = await getClientIp();

  const isRateLimited = await checkRateLimit(email, ip, "login", LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
  if (isRateLimited) {
    return { error: "Too many login attempts. Please try again later." };
  }

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await recordAttempt(email, ip, "login");
      return { error: "Invalid email or password" };
    }
    throw error;
  }
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  if (!email || !password || !fullName) {
    return { error: "All fields are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const ip = await getClientIp();

  const isRateLimited = await checkRateLimit(email, ip, "signup", SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_MS);
  if (isRateLimited) {
    return { error: "Too many signup attempts. Please try again later." };
  }

  // Record attempt before checking user existence to prevent email enumeration
  // via timing differences between "exists" and "doesn't exist" responses
  await recordAttempt(email, ip, "signup");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName,
      authProvider: "credentials",
    },
  });

  sendEmailSafe(email, "Welcome to SplitEase!", welcomeEmail(fullName));

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created but sign-in failed. Please log in." };
    }
    throw error;
  }
}

export async function signOut() {
  await nextAuthSignOut({ redirectTo: "/login" });
}

export async function changePassword(formData: FormData) {
  const user = await getAuthenticatedUser();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword) {
    return { error: "New password is required" };
  }

  if (newPassword.length < 6) {
    return { error: "New password must be at least 6 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });

  if (!dbUser) {
    return { error: "User not found" };
  }

  // If user already has a password, verify the current one
  if (dbUser.password) {
    if (!currentPassword) {
      return { error: "Current password is required" };
    }
    const valid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!valid) {
      return { error: "Current password is incorrect" };
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, passwordChangedAt: new Date() },
  });

  return { success: "Password changed successfully" };
}

export async function updateProfile(input: { fullName: string }) {
  const user = await getAuthenticatedUser();

  const name = input.fullName.trim();
  if (!name) {
    return { error: "Name is required" };
  }
  if (name.length > 100) {
    return { error: "Name must be 100 characters or less" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { fullName: name },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: "Profile updated" };
}
