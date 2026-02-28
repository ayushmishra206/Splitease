"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const RATE_LIMIT = 3; // max tokens per hour
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    return { error: "Email is required" };
  }

  // Always return success to avoid revealing whether an account exists
  const successMessage =
    "If an account exists with that email, we've sent a password reset link.";

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, email: true },
  });

  if (!user) {
    return { success: successMessage };
  }

  // Rate limit: max 3 tokens per hour per user
  const oneHourAgo = new Date(Date.now() - TOKEN_EXPIRY_MS);
  const recentCount = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCount >= RATE_LIMIT) {
    return { success: successMessage };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  void sendEmail(
    user.email,
    "Reset your SplitEase password",
    passwordResetEmail(user.fullName ?? "there", resetUrl)
  );

  return { success: successMessage };
}

export async function resetPassword(formData: FormData) {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token) {
    return { error: "Invalid reset link" };
  }

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!resetToken) {
    return { error: "Invalid or expired reset link" };
  }

  if (resetToken.usedAt) {
    return { error: "This reset link has already been used" };
  }

  if (new Date() > resetToken.expiresAt) {
    return { error: "This reset link has expired. Please request a new one." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: "Password reset successfully. You can now sign in." };
}
