# SplitEase Next.js Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite SplitWisely as SplitEase using Next.js 15 (App Router), Prisma, shadcn/ui, and deploy on Vercel — achieving full feature parity with the current React+Vite app.

**Architecture:** Prisma connects directly to Supabase PostgreSQL for type-safe data access. Supabase Auth (`@supabase/ssr`) handles authentication via Next.js middleware. Server Components fetch data; Server Actions handle mutations. shadcn/ui provides the component library.

**Tech Stack:** Next.js 15, TypeScript 5, Prisma, Supabase Auth, shadcn/ui, Tailwind CSS, React Hook Form + Zod, Vercel

**Reference Design:** `docs/plans/2026-02-28-splitease-rewrite-design.md`

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `components.json`
- Create: `.env.local` (gitignored)

**Step 1: Create Next.js app in a new directory**

```bash
cd /home/ayush/projects
npx create-next-app@latest splitease --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Accept defaults. This creates the project skeleton with App Router.

**Step 2: Install core dependencies**

```bash
cd /home/ayush/projects/splitease
npm install @supabase/supabase-js @supabase/ssr prisma @prisma/client
npm install react-hook-form @hookform/resolvers zod
npm install date-fns react-icons
npm install -D supabase
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Then install the components we need:

```bash
npx shadcn@latest add button card input label select textarea dialog dropdown-menu avatar badge separator tabs toast sonner
```

**Step 4: Create `.env.local`**

```env
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Prisma (Supabase PostgreSQL)
DATABASE_URL=<supabase-pooled-connection-string>
DIRECT_URL=<supabase-direct-connection-string>
```

Fill in real values from Supabase dashboard → Settings → Database → Connection string. Use the "Transaction" pooler for `DATABASE_URL` and "Direct" for `DIRECT_URL`. Append `?pgbouncer=true` to `DATABASE_URL`.

**Step 5: Update `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence Prisma warnings in dev
  webpack: (config) => {
    config.externals = [...(config.externals || []), "bcrypt"];
    return config;
  },
};

export default nextConfig;
```

**Step 6: Copy the database backup and PRD from old project**

```bash
cp /home/ayush/projects/splitwisely/db_cluster-04-11-2025@19-42-35.backup.gz /home/ayush/projects/splitease/
cp -r /home/ayush/projects/splitwisely/docs /home/ayush/projects/splitease/docs
```

**Step 7: Initialize git and commit**

```bash
cd /home/ayush/projects/splitease
git init
git add .
git commit -m "chore: scaffold Next.js 15 project with dependencies"
```

---

## Task 2: Set Up Prisma with Supabase

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

**Step 1: Initialize Prisma**

```bash
npx prisma init
```

**Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Profile {
  id        String   @id @db.Uuid
  fullName  String?  @map("full_name")
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  ownedGroups     Group[]        @relation("GroupOwner")
  memberships     GroupMember[]
  paidExpenses    Expense[]
  expenseSplits   ExpenseSplit[]
  settlementsFrom Settlement[]   @relation("SettlementFrom")
  settlementsTo   Settlement[]   @relation("SettlementTo")

  @@map("profiles")
}

model Group {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ownerId     String   @map("owner_id") @db.Uuid
  name        String
  description String?
  currency    String   @default("USD")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  owner       Profile       @relation("GroupOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  members     GroupMember[]
  expenses    Expense[]
  settlements Settlement[]

  @@map("groups")
}

model GroupMember {
  groupId  String   @map("group_id") @db.Uuid
  memberId String   @map("member_id") @db.Uuid
  role     String   @default("member")
  joinedAt DateTime @default(now()) @map("joined_at") @db.Timestamptz(6)

  group  Group   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  member Profile @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@id([groupId, memberId])
  @@map("group_members")
}

model Expense {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  groupId     String   @map("group_id") @db.Uuid
  payerId     String   @map("payer_id") @db.Uuid
  description String
  amount      Decimal  @db.Decimal(12, 2)
  expenseDate DateTime @map("expense_date") @db.Date
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  group  Group          @relation(fields: [groupId], references: [id], onDelete: Cascade)
  payer  Profile        @relation(fields: [payerId], references: [id], onDelete: SetNull)
  splits ExpenseSplit[]

  @@map("expenses")
}

model ExpenseSplit {
  id        String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  expenseId String  @map("expense_id") @db.Uuid
  memberId  String  @map("member_id") @db.Uuid
  share     Decimal @db.Decimal(12, 2)

  expense Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  member  Profile @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@map("expense_splits")
}

model Settlement {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  groupId        String   @map("group_id") @db.Uuid
  fromMember     String   @map("from_member") @db.Uuid
  toMember       String   @map("to_member") @db.Uuid
  amount         Decimal  @db.Decimal(12, 2)
  settlementDate DateTime @map("settlement_date") @db.Date
  notes          String?
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  group Group   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  from  Profile @relation("SettlementFrom", fields: [fromMember], references: [id], onDelete: Cascade)
  to    Profile @relation("SettlementTo", fields: [toMember], references: [id], onDelete: Cascade)

  @@map("settlements")
}
```

**Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` message.

**Step 4: Validate schema matches live DB**

```bash
npx prisma db pull --force
```

Review the output schema — it should match what we wrote. If there are differences, update our schema to match.

**Step 5: Create `lib/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 6: Commit**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: set up Prisma schema with Supabase PostgreSQL"
```

---

## Task 3: Set Up Supabase Auth Helpers

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts` (root)

**Step 1: Create `lib/supabase/server.ts`**

Server-side Supabase client for Server Components and Server Actions:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

**Step 2: Create `lib/supabase/client.ts`**

Browser-side Supabase client for Client Components:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 3: Create `lib/supabase/middleware.ts`**

Helper that refreshes the session in middleware:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to /login (except auth pages)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/signup"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

**Step 4: Create root `middleware.ts`**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: set up Supabase auth with middleware session refresh"
```

---

## Task 4: Utility Functions

**Files:**
- Create: `lib/utils.ts`

**Step 1: Create `lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function computeEqualSplit(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((total * 100) / count) / 100;
  const remainder = Math.round((total - base * count) * 100);
  return Array.from({ length: count }, (_, i) =>
    Math.round((base + (i < remainder ? 0.01 : 0)) * 100) / 100
  );
}
```

Note: `cn` is likely already created by shadcn init. If so, just add the other two functions to the existing file.

**Step 2: Commit**

```bash
git add lib/utils.ts
git commit -m "feat: add utility functions (formatCurrency, computeEqualSplit)"
```

---

## Task 5: Root Layout, Theme, and Global Styles

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `components/theme-provider.tsx`
- Create: `public/favicon.svg`

**Step 1: Create `components/theme-provider.tsx`**

Use `next-themes` for theme management:

```bash
npm install next-themes
```

```typescript
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

**Step 2: Update `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SplitEase",
  description:
    "SplitEase helps you track shared expenses, settle balances, and stay organized with friends and family.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="splitease:theme"
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 3: Update `app/globals.css`**

Keep the shadcn/ui generated CSS variables. Add the gradient background utilities from the current app:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* shadcn/ui CSS variables are already here from init — keep them */

@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 4: Create `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#4F46E5"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    fill="white" font-family="system-ui, sans-serif" font-weight="700" font-size="14">
    SE
  </text>
</svg>
```

**Step 5: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` — should redirect to `/login` (via middleware). This confirms auth middleware works.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: root layout with theme provider, Inter font, and SplitEase branding"
```

---

## Task 6: Auth Pages (Login + Signup)

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Create: `actions/auth.ts`

**Step 1: Create `actions/auth.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Sync profile to profiles table
  if (data.user) {
    await prisma.profile.upsert({
      where: { id: data.user.id },
      update: { fullName },
      create: { id: data.user.id, fullName },
    });
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

**Step 2: Create `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-100 via-slate-100 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-5xl bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_60%)]" />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
```

**Step 3: Create `app/(auth)/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
          <span className="text-lg font-bold">SE</span>
        </div>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to SplitEase</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create `app/(auth)/signup/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
          <span className="text-lg font-bold">SE</span>
        </div>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Get started with SplitEase</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" type="text" required minLength={2} maxLength={60} autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Verify auth flow**

```bash
npm run dev
```

1. Open `http://localhost:3000` → should redirect to `/login`
2. Click "Sign up" link → navigate to `/signup`
3. Create account → should redirect to `/` (dashboard)
4. Sign out → should redirect to `/login`
5. Sign in with created account → should redirect to `/`

**Step 6: Commit**

```bash
git add .
git commit -m "feat: auth pages with Supabase login/signup and profile sync"
```

---

## Task 7: Dashboard Layout (Sidebar, Header, Mobile Nav)

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/header.tsx`
- Create: `components/layout/mobile-nav.tsx`
- Create: `components/layout/theme-toggle.tsx`
- Create: `components/layout/user-menu.tsx`

**Step 1: Create `components/layout/sidebar.tsx`**

Port the sidebar from `App.tsx`. Key elements:
- SE logo badge with "SplitEase" text and tagline "Split expenses, not friendships."
- Navigation links: Dashboard, Groups, Expenses, Settlements, Settings
- Active state highlighting (indigo bg for active)
- Theme toggle button
- Sign out button
- Icons from react-icons (FiBarChart2, FiUsers, FiFileText, FiCheckCircle, FiSettings)

Use `usePathname()` from `next/navigation` for active state instead of React Router's `NavLink`.

**Step 2: Create `components/layout/header.tsx`**

Port the header from `App.tsx`:
- Current date display (uppercase tracking)
- Active page title
- "Quick add expense" button (links to `/expenses?create=true`)
- User avatar (first letter of email) and name/email display
- Mobile: compact buttons for add, theme toggle, sign out, avatar

**Step 3: Create `components/layout/mobile-nav.tsx`**

Port mobile bottom navigation:
- Fixed bottom bar, hidden on md+ screens
- Same 5 nav items as sidebar
- Active state: indigo text color
- Uses `usePathname()` for active detection

**Step 4: Create `components/layout/theme-toggle.tsx`**

```tsx
"use client";

import { useTheme } from "next-themes";
import { FiSun, FiMoon } from "react-icons/fi";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      className="w-full justify-center gap-2"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </Button>
  );
}
```

**Step 5: Create `app/(dashboard)/layout.tsx`**

This layout wraps all authenticated pages. It needs to:
1. Get the authenticated user from Supabase (server-side)
2. Sync user profile to DB (like SupabaseProvider did)
3. Render sidebar + header + mobile nav + main content area

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Sync profile
  const fullName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  await prisma.profile.upsert({
    where: { id: user.id },
    update: { fullName, avatarUrl: user.user_metadata?.avatar_url },
    create: { id: user.id, fullName, avatarUrl: user.user_metadata?.avatar_url },
  });

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-50">
      <Sidebar user={user} />
      <main className="relative flex min-h-screen flex-1 flex-col">
        <Header user={user} />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:pb-12">
          {children}
        </div>
        <MobileNav />
      </main>
    </div>
  );
}
```

**Step 6: Create placeholder `app/(dashboard)/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center dark:border-slate-700/70 dark:bg-slate-900/60">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming soon...</p>
    </div>
  );
}
```

**Step 7: Verify layout renders**

```bash
npm run dev
```

Sign in → should see sidebar, header, mobile nav, and "Dashboard" placeholder.

**Step 8: Commit**

```bash
git add .
git commit -m "feat: dashboard layout with sidebar, header, and mobile navigation"
```

---

## Task 8: Groups Server Actions

**Files:**
- Create: `actions/groups.ts`
- Create: `lib/auth.ts` (shared auth helper)

**Step 1: Create `lib/auth.ts`**

Shared helper to get the authenticated user in Server Actions:

```typescript
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}
```

**Step 2: Create `actions/groups.ts`**

Port all group operations from `services/groups.ts` and `hooks/useGroups.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

// Fetch all groups the user is a member of
export async function fetchGroups() {
  const user = await getAuthenticatedUser();

  return prisma.group.findMany({
    where: {
      members: { some: { memberId: user.id } },
    },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      members: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// Create a new group with the current user as owner
export async function createGroup(input: {
  name: string;
  description?: string;
  currency?: string;
  memberIds?: string[];
}) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      currency: input.currency ?? "USD",
      ownerId: user.id,
      members: {
        create: [
          { memberId: user.id, role: "owner" },
          ...(input.memberIds ?? [])
            .filter((id) => id !== user.id)
            .map((id) => ({ memberId: id, role: "member" as const })),
        ],
      },
    },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      members: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  });

  revalidatePath("/groups");
  revalidatePath("/");
  return group;
}

// Update a group
export async function updateGroup(
  id: string,
  input: { name?: string; description?: string; currency?: string }
) {
  const user = await getAuthenticatedUser();

  // Verify ownership
  const group = await prisma.group.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!group) throw new Error("Group not found or not authorized");

  const updated = await prisma.group.update({
    where: { id },
    data: input,
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      members: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  });

  revalidatePath("/groups");
  revalidatePath("/");
  return updated;
}

// Delete a group
export async function deleteGroup(id: string) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!group) throw new Error("Group not found or not authorized");

  await prisma.group.delete({ where: { id } });
  revalidatePath("/groups");
  revalidatePath("/");
}

// Add a member to a group
export async function addGroupMember(groupId: string, memberId: string) {
  const user = await getAuthenticatedUser();

  // Verify user is group owner
  const group = await prisma.group.findFirst({
    where: { id: groupId, ownerId: user.id },
  });
  if (!group) throw new Error("Not authorized to manage this group");

  const member = await prisma.groupMember.create({
    data: { groupId, memberId, role: "member" },
    include: {
      member: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });

  revalidatePath("/groups");
  return member;
}

// Remove a member from a group
export async function removeGroupMember(groupId: string, memberId: string) {
  const user = await getAuthenticatedUser();

  const group = await prisma.group.findFirst({
    where: { id: groupId, ownerId: user.id },
  });
  if (!group) throw new Error("Not authorized to manage this group");

  await prisma.groupMember.delete({
    where: { groupId_memberId: { groupId, memberId } },
  });

  revalidatePath("/groups");
}

// Search profiles by name (for member search)
export async function searchProfiles(term: string) {
  if (term.length < 2) return [];

  return prisma.profile.findMany({
    where: {
      fullName: { contains: term, mode: "insensitive" },
    },
    select: { id: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
    take: 10,
  });
}
```

**Step 3: Commit**

```bash
git add actions/groups.ts lib/auth.ts
git commit -m "feat: groups server actions (CRUD, member management, profile search)"
```

---

## Task 9: Groups Page

**Files:**
- Create: `app/(dashboard)/groups/page.tsx`
- Create: `components/groups/group-list.tsx`
- Create: `components/groups/group-form.tsx`
- Create: `components/groups/group-member-manager.tsx`

**Step 1: Create `app/(dashboard)/groups/page.tsx`**

Server Component that fetches groups and renders the list:

```tsx
import { fetchGroups } from "@/actions/groups";
import { GroupList } from "@/components/groups/group-list";

export default async function GroupsPage() {
  const groups = await fetchGroups();

  return <GroupList groups={groups} />;
}
```

**Step 2: Create `components/groups/group-list.tsx`**

Client Component that manages all the modal interactions. Port from `GroupsPage.tsx`:

Key features to port:
- Group cards showing name, description, currency, member count, created date
- "New Group" button opening create modal
- Edit button opening edit modal (prefilled)
- Delete button with confirmation dialog
- "Manage Members" button opening member manager modal
- FAB for mobile
- Empty state when no groups
- Status messages for success/error (use `sonner` toast)

Use shadcn `Dialog` for modals, `Button`, `Card` for layout.

**Step 3: Create `components/groups/group-form.tsx`**

Client Component with React Hook Form + Zod. Port from `GroupForm.tsx`:

Fields: name, description, currency selector (USD, EUR, GBP, INR, CAD, AUD).
Accept optional `additionalContent` for member selection during creation.
Accept `defaultValues` for edit mode.

**Step 4: Create `components/groups/group-member-manager.tsx`**

Client Component. Port from `GroupsPage.tsx` member management modal:

Features:
- Current member list (sorted alphabetically)
- Search input (min 2 chars) that calls `searchProfiles` server action
- Add button per search result
- Remove button per member (hidden for owner and self)
- Loading states during add/remove
- Filter out current members and self from search results

**Step 5: Verify groups CRUD works**

```bash
npm run dev
```

1. Navigate to `/groups`
2. Create a group → card appears
3. Edit the group → name updates
4. Manage members → search and add works
5. Delete group → card removed

**Step 6: Commit**

```bash
git add .
git commit -m "feat: groups page with CRUD, member management, and profile search"
```

---

## Task 10: Expenses Server Actions

**Files:**
- Create: `actions/expenses.ts`

**Step 1: Create `actions/expenses.ts`**

Port from `services/expenses.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function fetchExpenses(groupId?: string) {
  const user = await getAuthenticatedUser();

  // Get user's group IDs
  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const where: Record<string, unknown> = {
    groupId: groupId ? { in: groupIds.includes(groupId) ? [groupId] : [] } : { in: groupIds },
  };

  return prisma.expense.findMany({
    where,
    include: {
      group: { select: { id: true, name: true, currency: true } },
      payer: { select: { id: true, fullName: true, avatarUrl: true } },
      splits: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { expenseDate: "desc" },
  });
}

export async function createExpense(input: {
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  expenseDate: string;
  notes?: string;
  splits: { memberId: string; share: number }[];
}) {
  const user = await getAuthenticatedUser();

  // Verify membership
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: input.groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  const expense = await prisma.expense.create({
    data: {
      groupId: input.groupId,
      description: input.description,
      amount: input.amount,
      payerId: input.payerId,
      expenseDate: new Date(input.expenseDate),
      notes: input.notes,
      splits: {
        create: input.splits.map((s) => ({
          memberId: s.memberId,
          share: s.share,
        })),
      },
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      payer: { select: { id: true, fullName: true, avatarUrl: true } },
      splits: {
        include: {
          member: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/");
  return expense;
}

export async function updateExpense(input: {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  expenseDate: string;
  notes?: string;
  splits: { memberId: string; share: number }[];
}) {
  const user = await getAuthenticatedUser();

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: input.groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  // Use transaction: update expense + delete old splits + create new splits
  const expense = await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId: input.id } });

    return tx.expense.update({
      where: { id: input.id },
      data: {
        groupId: input.groupId,
        description: input.description,
        amount: input.amount,
        payerId: input.payerId,
        expenseDate: new Date(input.expenseDate),
        notes: input.notes,
        splits: {
          create: input.splits.map((s) => ({
            memberId: s.memberId,
            share: s.share,
          })),
        },
      },
      include: {
        group: { select: { id: true, name: true, currency: true } },
        payer: { select: { id: true, fullName: true, avatarUrl: true } },
        splits: {
          include: {
            member: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });
  });

  revalidatePath("/expenses");
  revalidatePath("/");
  return expense;
}

export async function deleteExpense(id: string) {
  const user = await getAuthenticatedUser();

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { group: { include: { members: true } } },
  });
  if (!expense) throw new Error("Expense not found");

  const isMember = expense.group.members.some((m) => m.memberId === user.id);
  if (!isMember) throw new Error("Not authorized");

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/");
}
```

**Step 2: Commit**

```bash
git add actions/expenses.ts
git commit -m "feat: expense server actions (CRUD with splits)"
```

---

## Task 11: Expenses Page

**Files:**
- Create: `app/(dashboard)/expenses/page.tsx`
- Create: `components/expenses/expense-list.tsx`
- Create: `components/expenses/expense-form.tsx`
- Create: `components/expenses/expense-delete-button.tsx`

**Step 1: Create `app/(dashboard)/expenses/page.tsx`**

Server Component:

```tsx
import { fetchExpenses } from "@/actions/expenses";
import { fetchGroups } from "@/actions/groups";
import { createClient } from "@/lib/supabase/server";
import { ExpenseList } from "@/components/expenses/expense-list";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [expenses, groups] = await Promise.all([
    fetchExpenses(),
    fetchGroups(),
  ]);

  return <ExpenseList expenses={expenses} groups={groups} currentUserId={user!.id} />;
}
```

**Step 2: Create `components/expenses/expense-list.tsx`**

Client Component. Port from `ExpensesPage.tsx`:

Key features:
- Group filter dropdown (all groups or specific)
- Client-side filtering of expenses by selected group
- Expense cards showing: group name, description, amount (colored badge), date, payer name, participant breakdown with amounts, notes
- "New Expense" button → opens create dialog
- Edit button → opens edit dialog (prefilled)
- Delete button → confirmation dialog
- Quick Add Card for mobile (preset amounts, group selector)
- Empty states for no groups / no expenses
- Re-fetches after mutations using `useRouter().refresh()`

**Step 3: Create `components/expenses/expense-form.tsx`**

Client Component with React Hook Form + Zod. Port from `ExpenseForm.tsx`:

This is the most complex form. Key features:
- Group selector (required)
- Date input (defaults to today, max = today)
- Description input (1-120 chars)
- Amount input (positive decimal)
- Who Paid dropdown (shows group members, owner indicator)
- Participants checkboxes in grid layout (min 1 required)
- Split method toggle: Equal vs Custom
  - Equal: auto-calculates and shows preview using `computeEqualSplit()`
  - Custom: manual input per participant, validates sum matches total (±0.01)
- Notes textarea (max 240 chars)
- Dynamic resets: group change resets participants/payer, participant change updates custom splits

**Step 4: Create `components/expenses/expense-delete-button.tsx`**

Client Component with confirmation dialog using shadcn `AlertDialog`.

**Step 5: Verify expenses CRUD works**

1. Create expense with equal split → verify card shows correct split amounts
2. Create expense with custom split → verify validation (sum must equal total)
3. Edit an expense → verify data prefilled correctly
4. Delete an expense → verify removed from list
5. Filter by group → only shows expenses for that group

**Step 6: Commit**

```bash
git add .
git commit -m "feat: expenses page with CRUD, equal/custom splits, and group filtering"
```

---

## Task 12: Settlements Server Actions

**Files:**
- Create: `actions/settlements.ts`

**Step 1: Create `actions/settlements.ts`**

Port from `services/settlements.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function fetchSettlements(groupId?: string) {
  const user = await getAuthenticatedUser();

  const memberships = await prisma.groupMember.findMany({
    where: { memberId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  return prisma.settlement.findMany({
    where: {
      groupId: groupId ? { in: groupIds.includes(groupId) ? [groupId] : [] } : { in: groupIds },
      OR: [{ fromMember: user.id }, { toMember: user.id }],
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      from: { select: { id: true, fullName: true, avatarUrl: true } },
      to: { select: { id: true, fullName: true, avatarUrl: true } },
    },
    orderBy: { settlementDate: "desc" },
  });
}

export async function createSettlement(input: {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  settlementDate?: string;
  notes?: string;
}) {
  const user = await getAuthenticatedUser();

  if (input.fromMemberId === input.toMemberId) {
    throw new Error("From and To members must be different");
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: input.groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  const settlement = await prisma.settlement.create({
    data: {
      groupId: input.groupId,
      fromMember: input.fromMemberId,
      toMember: input.toMemberId,
      amount: input.amount,
      settlementDate: input.settlementDate ? new Date(input.settlementDate) : new Date(),
      notes: input.notes,
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      from: { select: { id: true, fullName: true, avatarUrl: true } },
      to: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });

  revalidatePath("/settlements");
  revalidatePath("/");
  return settlement;
}

export async function deleteSettlement(id: string) {
  const user = await getAuthenticatedUser();

  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { group: { include: { members: true } } },
  });
  if (!settlement) throw new Error("Settlement not found");

  const isMember = settlement.group.members.some((m) => m.memberId === user.id);
  if (!isMember) throw new Error("Not authorized");

  await prisma.settlement.delete({ where: { id } });
  revalidatePath("/settlements");
  revalidatePath("/");
}
```

**Step 2: Commit**

```bash
git add actions/settlements.ts
git commit -m "feat: settlement server actions (create, fetch, delete)"
```

---

## Task 13: Settlements Page

**Files:**
- Create: `app/(dashboard)/settlements/page.tsx`
- Create: `components/settlements/settlement-list.tsx`
- Create: `components/settlements/settlement-form.tsx`

**Step 1: Create `app/(dashboard)/settlements/page.tsx`**

```tsx
import { fetchSettlements } from "@/actions/settlements";
import { fetchGroups } from "@/actions/groups";
import { SettlementList } from "@/components/settlements/settlement-list";

export default async function SettlementsPage() {
  const [settlements, groups] = await Promise.all([
    fetchSettlements(),
    fetchGroups(),
  ]);

  return <SettlementList settlements={settlements} groups={groups} />;
}
```

**Step 2: Create `components/settlements/settlement-list.tsx`**

Port from `SettlementsPage.tsx`:

Key features:
- Group filter dropdown
- Settlement cards showing: group name, from → to (with arrow), amount badge, date, notes
- "New Settlement" button → opens dialog
- Delete button with confirmation
- Empty states for no groups / no settlements

**Step 3: Create `components/settlements/settlement-form.tsx`**

Port from `SettlementForm.tsx`:

Fields:
- Group selector (defaults to first group)
- From Member dropdown
- To Member dropdown (excludes selected from member)
- Amount input (positive decimal)
- Settlement Date (defaults to today)
- Notes textarea (max 240 chars)

Dynamic: group change updates member dropdowns, from change filters to dropdown.

**Step 4: Verify settlements work**

1. Create settlement → card appears with from/to/amount
2. Filter by group → only shows settlements for that group
3. Delete settlement → removed from list

**Step 5: Commit**

```bash
git add .
git commit -m "feat: settlements page with creation, filtering, and deletion"
```

---

## Task 14: Dashboard Page

**Files:**
- Modify: `app/(dashboard)/page.tsx`

**Step 1: Create the full Dashboard page**

This is the most data-intensive page. Port from `DashboardPage.tsx`:

The page is a Server Component that fetches all data and computes balances:

Key calculations to port:
1. For each group, for each member: calculate `paid` (sum of expenses where member is payer) and `owed` (sum of expense_splits where member is participant)
2. Apply settlements: subtract from balances
3. Compute net balance per member per group
4. Aggregate across currencies: total paid, total owed, net per currency

Key UI sections:
- **Currency summary cards**: One card per currency showing: Total Paid, Total Owed, Net Balance (green if positive, red if negative)
- **Attention section**: Top 4 groups where user has unresolved balances (balance > ±0.005)
- **Group summary cards**: For each group show: total spent, user's position (owed/owes), top 3 member balances, quick links to expenses/groups

All data is fetched server-side via Prisma. No client-side data fetching needed.

**Step 2: Verify dashboard shows correct balances**

Compare with the existing SplitWisely app to verify numbers match.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: dashboard with balance calculations across currencies"
```

---

## Task 15: Settings Page

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`
- Create: `actions/backup.ts`

**Step 1: Create `actions/backup.ts`**

Port from `services/backup.ts`:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function exportUserData() {
  const user = await getAuthenticatedUser();

  const groups = await prisma.group.findMany({
    where: { ownerId: user.id },
    include: {
      members: true,
      expenses: { include: { splits: true } },
      settlements: true,
    },
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    groups,
  };
}

export async function importUserData(payload: {
  version: number;
  groups: Array<{
    id: string;
    name: string;
    description?: string;
    currency: string;
    ownerId: string;
    members: Array<{ groupId: string; memberId: string; role: string }>;
    expenses: Array<{
      id: string;
      groupId: string;
      payerId: string;
      description: string;
      amount: number;
      expenseDate: string;
      notes?: string;
      splits: Array<{ id: string; expenseId: string; memberId: string; share: number }>;
    }>;
    settlements: Array<{
      id: string;
      groupId: string;
      fromMember: string;
      toMember: string;
      amount: number;
      settlementDate: string;
      notes?: string;
    }>;
  }>;
}) {
  const user = await getAuthenticatedUser();

  if (payload.version !== 1) throw new Error("Unsupported backup version");

  const results = { imported: 0, skipped: [] as Array<{ name: string; reason: string }>, errors: [] as string[] };

  for (const group of payload.groups) {
    if (group.ownerId !== user.id) {
      results.skipped.push({ name: group.name, reason: "Not owned by you" });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.group.upsert({
          where: { id: group.id },
          update: { name: group.name, description: group.description, currency: group.currency },
          create: { id: group.id, name: group.name, description: group.description, currency: group.currency, ownerId: user.id },
        });

        for (const member of group.members) {
          await tx.groupMember.upsert({
            where: { groupId_memberId: { groupId: member.groupId, memberId: member.memberId } },
            update: { role: member.role },
            create: member,
          });
        }

        for (const expense of group.expenses) {
          await tx.expense.upsert({
            where: { id: expense.id },
            update: { description: expense.description, amount: expense.amount, payerId: expense.payerId },
            create: {
              id: expense.id,
              groupId: expense.groupId,
              payerId: expense.payerId,
              description: expense.description,
              amount: expense.amount,
              expenseDate: new Date(expense.expenseDate),
              notes: expense.notes,
            },
          });

          for (const split of expense.splits) {
            await tx.expenseSplit.upsert({
              where: { id: split.id },
              update: { share: split.share },
              create: { id: split.id, expenseId: split.expenseId, memberId: split.memberId, share: split.share },
            });
          }
        }

        for (const settlement of group.settlements) {
          await tx.settlement.upsert({
            where: { id: settlement.id },
            update: { amount: settlement.amount, notes: settlement.notes },
            create: {
              id: settlement.id,
              groupId: settlement.groupId,
              fromMember: settlement.fromMember,
              toMember: settlement.toMember,
              amount: settlement.amount,
              settlementDate: new Date(settlement.settlementDate),
              notes: settlement.notes,
            },
          });
        }
      });
      results.imported++;
    } catch (e) {
      results.errors.push(`Failed to import "${group.name}": ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return results;
}
```

**Step 2: Create `app/(dashboard)/settings/page.tsx`**

Port from `SettingsPage.tsx`. Client Component with:

- **Data Management** section:
  - Export button → calls `exportUserData()` → downloads as `splitease-backup-{timestamp}.json`
  - Import button → file picker → reads JSON → calls `importUserData()` → shows result summary
- Theme info section (managed by next-themes, no custom code needed)

**Step 3: Verify settings page**

1. Export → downloads JSON file
2. Import → shows count of imported groups, skipped, errors

**Step 4: Commit**

```bash
git add .
git commit -m "feat: settings page with data export/import"
```

---

## Task 16: Cleanup and Final Polish

**Files:**
- Modify: various files for polish
- Delete: `app/page.tsx` (replaced by dashboard route group)

**Step 1: Remove the default Next.js landing page**

If `app/page.tsx` still has the default Next.js content, replace it with a redirect:

```tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/");
}
```

Actually, this is handled by the `(dashboard)` route group — the `app/(dashboard)/page.tsx` IS the `/` route. So remove any default `app/page.tsx` if it conflicts.

**Step 2: Add loading states**

Create `app/(dashboard)/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>
  );
}
```

**Step 3: Add error boundary**

Create `app/(dashboard)/error.tsx`:

```tsx
"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-red-300 bg-white p-16 text-center dark:border-red-700/70 dark:bg-slate-900/60">
      <h2 className="text-2xl font-semibold text-red-600">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">
        Try again
      </button>
    </div>
  );
}
```

**Step 4: Add not-found page**

Create `app/not-found.tsx`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Lost in the splits?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t find that page.
        </p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
```

**Step 5: Update `.gitignore`**

Ensure these are in `.gitignore`:
```
.env.local
.env*.local
node_modules/
.next/
prisma/migrations/
```

**Step 6: Verify full app works end-to-end**

Walk through every feature:
1. Sign up / sign in / sign out
2. Create group → add members → edit → delete
3. Create expense (equal split) → edit → delete
4. Create expense (custom split) → verify validation
5. Create settlement → delete
6. Dashboard shows correct balances
7. Settings export/import works
8. Dark mode toggle works
9. Mobile layout works (responsive)

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add loading states, error boundaries, and polish"
```

---

## Task 17: Deploy to Vercel

**Step 1: Create GitHub repository**

```bash
cd /home/ayush/projects/splitease
gh repo create splitease --public --source=. --push
```

**Step 2: Install Vercel CLI**

```bash
npm install -g vercel
```

**Step 3: Link to Vercel**

```bash
vercel link
```

Follow prompts to create a new Vercel project.

**Step 4: Set environment variables**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add DATABASE_URL
vercel env add DIRECT_URL
```

Enter the values from `.env.local` for each.

**Step 5: Configure build command**

In Vercel dashboard or `vercel.json`:

```json
{
  "buildCommand": "prisma generate && next build"
}
```

**Step 6: Deploy**

```bash
vercel --prod
```

**Step 7: Verify production deployment**

1. Open the Vercel URL
2. Test auth flow
3. Test CRUD operations
4. Verify data displays correctly

**Step 8: Commit vercel config**

```bash
git add vercel.json
git commit -m "chore: add Vercel deployment configuration"
git push
```

---

## Task 18: Update Documentation

**Files:**
- Create: `README.md`

**Step 1: Write `README.md`**

```markdown
# SplitEase

Split expenses, not friendships.

A modern expense-splitting web application built with Next.js, Prisma, and Supabase.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma
- **Auth:** Supabase Auth
- **UI:** shadcn/ui + Tailwind CSS
- **Deployment:** Vercel

## Getting Started

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials
3. Run `npm install`
4. Run `npx prisma generate`
5. Run `npm run dev`

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `DATABASE_URL` — Supabase pooled connection string
- `DIRECT_URL` — Supabase direct connection string
```

**Step 2: Final commit**

```bash
git add .
git commit -m "docs: add README for SplitEase"
git push
```

---

## Summary

| Task | Description | Dependencies |
|------|------------|-------------|
| 1 | Scaffold Next.js project | None |
| 2 | Set up Prisma with Supabase | Task 1 |
| 3 | Set up Supabase Auth helpers | Task 1 |
| 4 | Utility functions | Task 1 |
| 5 | Root layout, theme, globals | Tasks 1, 4 |
| 6 | Auth pages (login/signup) | Tasks 3, 5 |
| 7 | Dashboard layout (sidebar/header/nav) | Tasks 5, 6 |
| 8 | Groups server actions | Tasks 2, 3 |
| 9 | Groups page | Tasks 7, 8 |
| 10 | Expenses server actions | Tasks 2, 3 |
| 11 | Expenses page | Tasks 7, 9, 10 |
| 12 | Settlements server actions | Tasks 2, 3 |
| 13 | Settlements page | Tasks 7, 9, 12 |
| 14 | Dashboard page | Tasks 8, 10, 12 |
| 15 | Settings page | Tasks 7, 8 |
| 16 | Cleanup and polish | Tasks 6–15 |
| 17 | Deploy to Vercel | Task 16 |
| 18 | Update documentation | Task 17 |

**Parallelizable tasks:** Tasks 2+3+4 can run in parallel after Task 1. Tasks 8+10+12 can run in parallel after Tasks 2+3. Tasks 9, 11, 13, 14, 15 depend on their respective action tasks but are independent of each other.
