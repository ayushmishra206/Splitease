import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { sendEmailSafe } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials.email as string;
        const password = credentials.password as string;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.fullName };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        // Find or create user for Google OAuth
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, authProvider: true },
        });

        if (dbUser) {
          if (dbUser.authProvider === "credentials") {
            // Account created via email/password — don't auto-merge with OAuth
            return "/login?error=OAuthAccountNotLinked";
          }
          // Existing OAuth user (may have set a password later) — allow sign-in
          user.id = dbUser.id;
        } else {
          // New user — create account via OAuth
          const newUser = await prisma.user.create({
            data: {
              email: user.email,
              fullName: user.name ?? null,
              avatarUrl: user.image ?? null,
              authProvider: "google",
            },
          });
          sendEmailSafe(
            user.email,
            "Welcome to SplitEase!",
            welcomeEmail(user.name ?? "there")
          );
          user.id = newUser.id;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Store passwordChangedAt in token at sign-in to avoid per-request DB queries
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { passwordChangedAt: true },
        });
        token.passwordChangedAt = dbUser?.passwordChangedAt?.getTime() ?? 0;
        token.lastChecked = Date.now();
      }

      // Periodically re-check passwordChangedAt from DB (every 60 seconds)
      // to detect password changes without hitting DB on every request
      const lastChecked = (token.lastChecked as number) ?? 0;
      if (token.id && Date.now() - lastChecked > 60_000) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { passwordChangedAt: true },
        });
        const dbChangedAt = dbUser?.passwordChangedAt?.getTime() ?? 0;
        const tokenChangedAt = (token.passwordChangedAt as number) ?? 0;

        if (dbChangedAt > tokenChangedAt) {
          // Password was changed after this token was issued — force re-auth
          return {} as typeof token;
        }
        token.lastChecked = Date.now();
      }

      return token;
    },
  },
});
