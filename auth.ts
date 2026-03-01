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
      }
      // Check if password changed after token was issued (session invalidation)
      if (token.id && token.iat) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { passwordChangedAt: true },
        });
        if (dbUser?.passwordChangedAt) {
          const changedAtSec = Math.floor(dbUser.passwordChangedAt.getTime() / 1000);
          if (changedAtSec > (token.iat as number)) {
            return {} as typeof token; // Force re-auth by returning empty token
          }
        }
      }
      return token;
    },
  },
});
