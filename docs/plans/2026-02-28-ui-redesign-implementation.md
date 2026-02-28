# SplitEase UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SplitEase from a neutral gray/charcoal theme to a vibrant emerald/coral fintech-style UI with restructured navigation, new group detail page, and polished component library.

**Architecture:** Component-First Retheme — update design tokens in globals.css, then restyle UI primitives (button, card, input), then restructure layouts (sidebar, header, mobile nav, auth), then redesign each page. New group detail route with tabs absorbs the standalone settlements page.

**Tech Stack:** Next.js 16, Tailwind CSS 4, shadcn/ui, Radix UI, Lucide + react-icons, next-themes, Sonner, JetBrains Mono font, Prisma, Supabase Auth.

---

## Task 1: Design Tokens — Color Palette & Typography

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Step 1: Replace color tokens in globals.css**

Replace the entire `:root` and `.dark` blocks with the new emerald/coral palette. Also add `--success` and `--color-success` tokens. Update the `@theme inline` block to include new tokens.

Replace the contents of `app/globals.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
}

:root {
  --radius: 0.625rem;
  --background: #F8FAFC;
  --foreground: #0F172A;
  --card: #FFFFFF;
  --card-foreground: #0F172A;
  --popover: #FFFFFF;
  --popover-foreground: #0F172A;
  --primary: #10B981;
  --primary-foreground: #FFFFFF;
  --secondary: #F1F5F9;
  --secondary-foreground: #0F172A;
  --muted: #F1F5F9;
  --muted-foreground: #64748B;
  --accent: #F97316;
  --accent-foreground: #FFFFFF;
  --success: #22C55E;
  --success-foreground: #FFFFFF;
  --destructive: #EF4444;
  --border: #E2E8F0;
  --input: #E2E8F0;
  --ring: #10B981;
  --chart-1: #10B981;
  --chart-2: #F97316;
  --chart-3: #3B82F6;
  --chart-4: #8B5CF6;
  --chart-5: #EC4899;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #0F172A;
  --sidebar-primary: #10B981;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #F1F5F9;
  --sidebar-accent-foreground: #0F172A;
  --sidebar-border: #E2E8F0;
  --sidebar-ring: #10B981;
}

.dark {
  --background: #0F172A;
  --foreground: #F8FAFC;
  --card: #1E293B;
  --card-foreground: #F8FAFC;
  --popover: #1E293B;
  --popover-foreground: #F8FAFC;
  --primary: #34D399;
  --primary-foreground: #022C22;
  --secondary: #334155;
  --secondary-foreground: #F8FAFC;
  --muted: #334155;
  --muted-foreground: #94A3B8;
  --accent: #FB923C;
  --accent-foreground: #431407;
  --success: #4ADE80;
  --success-foreground: #022C22;
  --destructive: #F87171;
  --border: #334155;
  --input: #334155;
  --ring: #34D399;
  --chart-1: #34D399;
  --chart-2: #FB923C;
  --chart-3: #60A5FA;
  --chart-4: #A78BFA;
  --chart-5: #F472B6;
  --sidebar: #1E293B;
  --sidebar-foreground: #F8FAFC;
  --sidebar-primary: #34D399;
  --sidebar-primary-foreground: #022C22;
  --sidebar-accent: #334155;
  --sidebar-accent-foreground: #F8FAFC;
  --sidebar-border: #334155;
  --sidebar-ring: #34D399;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 2: Add JetBrains Mono font to root layout**

Update `app/layout.tsx` to import JetBrains Mono alongside Inter and set the CSS variable:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

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
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
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

**Step 3: Verify the app compiles and renders**

Run: `npm run dev` and open http://localhost:3001 in browser.
Expected: App renders with new emerald primary color, off-white background, coral accent. Dark mode toggle should show dark charcoal background with lighter emerald.

**Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: update design tokens — emerald/coral palette, JetBrains Mono font"
```

---

## Task 2: Utility Functions & Shared Constants

**Files:**
- Create: `lib/categories.ts`
- Modify: `lib/utils.ts`

**Step 1: Create category definitions**

Create `lib/categories.ts`:

```ts
export type ExpenseCategory =
  | "food"
  | "rent"
  | "transport"
  | "entertainment"
  | "groceries"
  | "travel"
  | "utilities"
  | "other";

export const CATEGORIES: Record<
  ExpenseCategory,
  { emoji: string; label: string; color: string }
> = {
  food: { emoji: "🍔", label: "Food", color: "text-orange-500" },
  rent: { emoji: "🏠", label: "Rent", color: "text-blue-500" },
  transport: { emoji: "🚗", label: "Transport", color: "text-yellow-500" },
  entertainment: { emoji: "🎬", label: "Entertainment", color: "text-purple-500" },
  groceries: { emoji: "🛒", label: "Groceries", color: "text-green-500" },
  travel: { emoji: "✈️", label: "Travel", color: "text-teal-500" },
  utilities: { emoji: "💡", label: "Utilities", color: "text-amber-500" },
  other: { emoji: "📦", label: "Other", color: "text-gray-500" },
};

export const DEFAULT_CATEGORY: ExpenseCategory = "other";

export function getCategoryEmoji(category?: string): string {
  if (!category || !(category in CATEGORIES)) return CATEGORIES.other.emoji;
  return CATEGORIES[category as ExpenseCategory].emoji;
}

export function getCategoryColor(category?: string): string {
  if (!category || !(category in CATEGORIES)) return CATEGORIES.other.color;
  return CATEGORIES[category as ExpenseCategory].color;
}
```

**Step 2: Commit**

```bash
git add lib/categories.ts
git commit -m "feat: add expense category definitions and helpers"
```

---

## Task 3: Restyle UI Primitives — Button, Card, Input

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/card.tsx`
- Modify: `components/ui/input.tsx`

**Step 1: Update Button component**

Add `active:scale-[0.97] transition-transform` to the base styles and add an `accent` variant. Update `rounded-md` to `rounded-xl` for default size:

In `components/ui/button.tsx`, replace the `buttonVariants` cva call:

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90",
        outline:
          "border bg-background shadow-xs hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

**Step 2: Update Card component**

In `components/ui/card.tsx`, update the Card function to use `rounded-2xl`:

Change:
```ts
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
```
To:
```ts
"bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border py-6 shadow-sm",
```

**Step 3: Verify**

Run: `npm run dev` and check that buttons show emerald green, cards have rounder corners.

**Step 4: Commit**

```bash
git add components/ui/button.tsx components/ui/card.tsx
git commit -m "feat: restyle button (emerald, accent variant, press feedback) and card (rounded-2xl)"
```

---

## Task 4: New Shared UI Components

**Files:**
- Create: `components/ui/amount-display.tsx`
- Create: `components/ui/avatar-stack.tsx`
- Create: `components/ui/category-badge.tsx`

**Step 1: Create AmountDisplay component**

Create `components/ui/amount-display.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

interface AmountDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  showSign?: boolean;
}

export function AmountDisplay({
  amount,
  currency = "USD",
  className,
  showSign = false,
}: AmountDisplayProps) {
  const isPositive = amount > 0;
  const isNegative = amount < 0;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        isPositive && "text-success",
        isNegative && "text-destructive",
        !isPositive && !isNegative && "text-muted-foreground",
        className
      )}
    >
      {showSign && isPositive && "+"}
      {formatCurrency(Math.abs(amount), currency)}
    </span>
  );
}
```

**Step 2: Create AvatarStack component**

Create `components/ui/avatar-stack.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface AvatarStackProps {
  names: string[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function AvatarStack({ names, max = 3, size = "sm", className }: AvatarStackProps) {
  const visible = names.slice(0, max);
  const overflow = names.length - max;

  const sizeClasses = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((name, i) => (
        <div
          key={i}
          title={name}
          className={cn(
            "inline-flex items-center justify-center rounded-full border-2 border-card font-medium text-white",
            sizeClasses,
            getColorForName(name)
          )}
        >
          {getInitials(name)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full border-2 border-card bg-muted font-medium text-muted-foreground",
            sizeClasses
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create CategoryBadge component**

Create `components/ui/category-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { getCategoryEmoji, type ExpenseCategory } from "@/lib/categories";

interface CategoryBadgeProps {
  category?: string;
  size?: "sm" | "md";
  className?: string;
}

const BADGE_BG: Record<string, string> = {
  food: "bg-orange-100 dark:bg-orange-900/30",
  rent: "bg-blue-100 dark:bg-blue-900/30",
  transport: "bg-yellow-100 dark:bg-yellow-900/30",
  entertainment: "bg-purple-100 dark:bg-purple-900/30",
  groceries: "bg-green-100 dark:bg-green-900/30",
  travel: "bg-teal-100 dark:bg-teal-900/30",
  utilities: "bg-amber-100 dark:bg-amber-900/30",
  other: "bg-gray-100 dark:bg-gray-900/30",
};

export function CategoryBadge({ category, size = "sm", className }: CategoryBadgeProps) {
  const emoji = getCategoryEmoji(category);
  const bg = BADGE_BG[category ?? "other"] ?? BADGE_BG.other;
  const sizeClasses = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl shrink-0",
        sizeClasses,
        bg,
        className
      )}
    >
      {emoji}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add components/ui/amount-display.tsx components/ui/avatar-stack.tsx components/ui/category-badge.tsx
git commit -m "feat: add AmountDisplay, AvatarStack, and CategoryBadge components"
```

---

## Task 5: Sidebar Redesign

**Files:**
- Modify: `components/layout/sidebar.tsx`

**Step 1: Rewrite the sidebar**

Replace the entire contents of `components/layout/sidebar.tsx` with the new 4-item nav, collapsible design, user dropdown, and emerald active states. Use Lucide icons (already installed) instead of react-icons for consistency:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Groups", path: "/groups", icon: Users },
  { label: "Expenses", path: "/expenses", icon: Receipt },
  { label: "Settings", path: "/settings", icon: Settings },
];

interface SidebarProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const displayName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:border-r md:border-border md:bg-card transition-all duration-200",
        collapsed ? "md:w-16" : "md:w-60"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn("flex items-center gap-3 border-b border-border px-4 py-5", collapsed && "justify-center px-2")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
            SE
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">SplitEase</p>
              <p className="text-[11px] text-muted-foreground truncate">Split smart. Stay even.</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map(({ label, path, icon: Icon }) => {
            const isActive = path === "/" ? pathname === "/" : pathname.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="space-y-1 border-t border-border px-2 py-4">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title={collapsed ? "Toggle theme" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5 shrink-0" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" />
            )}
            {!collapsed && <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>}
          </button>

          {/* User + sign out */}
          <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", collapsed && "justify-center px-2")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            )}
          </div>

          <form action={signOut}>
            <button
              type="submit"
              title={collapsed ? "Sign out" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10",
                collapsed && "justify-center px-2"
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </form>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
```

**Step 2: Verify**

Open app in browser. Sidebar should show 4 items with emerald active pill, collapsible toggle, theme toggle, user info, sign out.

**Step 3: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: redesign sidebar — 4-item nav, collapsible, emerald active states"
```

---

## Task 6: Header Simplification

**Files:**
- Modify: `components/layout/header.tsx`

**Step 1: Rewrite header**

Replace the entire contents of `components/layout/header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/groups": "Groups",
  "/expenses": "Expenses",
  "/settings": "Settings",
};

interface HeaderProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
  };
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();

  // For group detail pages, show "Groups" as title
  const title = pathname.startsWith("/groups/")
    ? "Groups"
    : titleMap[pathname] ?? "Dashboard";

  const displayName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold">{title}</h1>

        {/* Desktop: Add Expense CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button asChild>
            <Link href="/expenses?create=true">
              <Plus className="h-4 w-4" />
              Add Expense
            </Link>
          </Button>
        </div>

        {/* Mobile: User avatar */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add components/layout/header.tsx
git commit -m "feat: simplify header — page title + Add Expense CTA only"
```

---

## Task 7: Mobile Navigation with Raised Add Button

**Files:**
- Modify: `components/layout/mobile-nav.tsx`

**Step 1: Rewrite mobile nav**

Replace the entire contents of `components/layout/mobile-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Plus, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", path: "/", icon: LayoutDashboard },
  { label: "Groups", path: "/groups", icon: Users },
  { label: "Add", path: "/expenses?create=true", icon: Plus, isCenter: true },
  { label: "Expenses", path: "/expenses", icon: Receipt },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {navItems.map(({ label, path, icon: Icon, isCenter }) => {
          const isActive = !isCenter && (path === "/" ? pathname === "/" : pathname.startsWith(path));

          if (isCenter) {
            return (
              <Link
                key="add"
                href={path}
                className="flex flex-col items-center gap-0.5"
              >
                <div className="flex h-12 w-12 -mt-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-[0.97] transition-transform">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 2: Commit**

```bash
git add components/layout/mobile-nav.tsx
git commit -m "feat: redesign mobile nav — raised center Add button, 5 tabs"
```

---

## Task 8: Dashboard Layout Update

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

**Step 1: Update dashboard layout**

In `app/(dashboard)/layout.tsx`, update the wrapper div and content area to use new tokens and max-width. Replace the return statement:

Change the outer div from:
```tsx
<div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-50">
```
To:
```tsx
<div className="flex min-h-screen bg-background text-foreground">
```

Change the content area div from:
```tsx
<div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:pb-12">
```
To:
```tsx
<div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
```

**Step 2: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "feat: update dashboard layout — flat background, tighter max-width"
```

---

## Task 9: Auth Layout — Split Design

**Files:**
- Modify: `app/(auth)/layout.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/signup/page.tsx`

**Step 1: Rewrite auth layout with split design**

Replace the entire contents of `app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-800 px-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur text-white text-2xl font-bold mb-6">
          SE
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">SplitEase</h1>
        <p className="text-emerald-100 text-center max-w-xs">
          Split smart. Stay even. The easiest way to share expenses with friends and family.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col bg-background">
        {/* Mobile brand header */}
        <div className="flex items-center gap-3 px-6 py-5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
            SE
          </div>
          <div>
            <p className="text-sm font-semibold">SplitEase</p>
            <p className="text-[11px] text-muted-foreground">Split smart. Stay even.</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update login page**

Read and update `app/(auth)/login/page.tsx` to remove the card wrapper (layout handles it now) and use new primary color. Replace the logo section and button styling — change `bg-indigo-600` to `bg-primary` and use the Button component:

The login page should render a clean form without the card wrapper since the auth layout already provides the container. Replace the full file:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
```

**Step 3: Update signup page**

Replace the full file `app/(auth)/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await signUp(formData);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Create your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start splitting expenses with friends and family
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Your name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

**Step 4: Verify**

Navigate to `/login` and `/signup`. Desktop should show split layout with emerald gradient left panel. Mobile should show compact header + form.

**Step 5: Commit**

```bash
git add app/(auth)/layout.tsx app/(auth)/login/page.tsx app/(auth)/signup/page.tsx
git commit -m "feat: redesign auth pages — split layout, emerald brand panel"
```

---

## Task 10: Dashboard Redesign — Balance Cards & Group Grid

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx`
- Modify: `actions/dashboard.ts`
- Modify: `app/(dashboard)/loading.tsx`

**Step 1: Update dashboard data action**

Add member names list and last activity timestamp to `GroupSummary` in `actions/dashboard.ts`. Add `memberNames` and `lastActivity` fields to the `GroupSummary` type and populate them in the `fetchDashboardData` function.

In the `GroupSummary` type, add:
```ts
memberNames: string[];
lastActivity: Date | null;
```

In the loop where `groupSummaries.push(...)`, add the member names from the expenses and compute last activity:
```ts
// Collect unique member names for avatar stack
const uniqueMembers = new Map<string, string>();
for (const expense of groupExpenses) {
  uniqueMembers.set(expense.payerId, expense.payer.fullName ?? "Unknown");
  for (const split of expense.splits) {
    uniqueMembers.set(split.memberId, split.member.fullName ?? "Unknown");
  }
}

const lastExpense = groupExpenses[0];
const lastSettlement = groupSettlements.sort((a, b) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
)[0];
const lastActivity = lastExpense?.createdAt
  ? lastSettlement?.createdAt
    ? new Date(Math.max(
        new Date(lastExpense.createdAt).getTime(),
        new Date(lastSettlement.createdAt).getTime()
      ))
    : new Date(lastExpense.createdAt)
  : lastSettlement?.createdAt
    ? new Date(lastSettlement.createdAt)
    : null;

groupSummaries.push({
  id: group.id,
  name: group.name,
  currency: group.currency,
  totalExpenses: Math.round(totalExp * 100) / 100,
  balances,
  memberNames: Array.from(uniqueMembers.values()),
  lastActivity,
});
```

**Step 2: Rewrite dashboard client**

Replace the entire contents of `components/dashboard/dashboard-client.tsx`:

```tsx
"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getCategoryEmoji } from "@/lib/categories";
import type { DashboardData } from "@/actions/dashboard";
import { AmountDisplay } from "@/components/ui/amount-display";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CategoryBadge } from "@/components/ui/category-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardClientProps {
  data: DashboardData;
  currentUserId: string;
}

export function DashboardClient({ data, currentUserId }: DashboardClientProps) {
  const netBalance = data.youAreOwed - data.youOwe;

  return (
    <div className="space-y-8">
      {/* Balance summary — 3 cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* You Owe */}
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5">
                <ArrowUpRight className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You owe</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-accent">
                  {formatCurrency(data.youOwe)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Owed to You */}
        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-success/10 p-2.5">
                <ArrowDownLeft className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owed to you</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-success">
                  {formatCurrency(data.youAreOwed)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card
          className={
            netBalance >= 0
              ? "border-primary/20 bg-primary/5"
              : "border-accent/20 bg-accent/5"
          }
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  netBalance >= 0 ? "bg-primary/10" : "bg-accent/10"
                }`}
              >
                <Scale
                  className={`h-5 w-5 ${
                    netBalance >= 0 ? "text-primary" : "text-accent"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net balance</p>
                <AmountDisplay
                  amount={netBalance}
                  showSign
                  className="text-2xl font-bold"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Groups</h2>
          <Link href="/groups" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        {data.groupSummaries.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-1">No groups yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first group to start splitting expenses
              </p>
              <Link
                href="/groups"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.97]"
              >
                Create a group
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.groupSummaries.map((group) => {
              const groupNet = group.balances.reduce((sum, b) => sum + b.amount, 0);
              return (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">
                              {group.name.charAt(0).toUpperCase() === group.name.charAt(0)
                                ? "📋"
                                : "📋"}
                            </span>
                            <h3 className="font-semibold truncate">{group.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <AvatarStack names={group.memberNames} max={3} size="sm" />
                            <span className="text-xs text-muted-foreground">
                              {group.memberNames.length} member{group.memberNames.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            {Math.abs(groupNet) < 0.01 ? (
                              <span className="text-sm text-muted-foreground">All settled up ✓</span>
                            ) : (
                              <AmountDisplay
                                amount={groupNet}
                                currency={group.currency}
                                showSign
                                className="text-sm font-semibold"
                              />
                            )}
                            {group.lastActivity && (
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(group.lastActivity), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent expenses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Expenses</h2>
          <Link href="/expenses" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        <Card>
          <CardContent className="pt-6">
            {data.recentExpenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses yet
              </p>
            ) : (
              <div className="space-y-4">
                {data.recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3"
                  >
                    <CategoryBadge />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {expense.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {expense.payerId === currentUserId ? "You" : expense.payerName} paid
                        {" · "}
                        {expense.groupName}
                        {" · "}
                        {format(new Date(expense.expenseDate), "MMM d")}
                      </p>
                    </div>
                    <AmountDisplay
                      amount={expense.amount}
                      currency={expense.currency}
                      className="text-sm font-semibold"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

Note: You'll need to add the `Users` import from lucide-react at the top.

**Step 3: Update loading skeleton**

Replace `app/(dashboard)/loading.tsx`:

```tsx
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Balance cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-7 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Groups grid skeleton */}
      <div>
        <div className="h-6 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-6">
              <div className="space-y-3">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent expenses skeleton */}
      <div>
        <div className="h-6 w-40 animate-pulse rounded bg-muted mb-4" />
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-xl bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Verify**

Open dashboard in browser. Should show 3 colored balance cards, group grid with avatar stacks, recent expenses with category badges.

**Step 5: Commit**

```bash
git add components/dashboard/dashboard-client.tsx actions/dashboard.ts app/(dashboard)/loading.tsx
git commit -m "feat: redesign dashboard — 3 balance cards, group grid with avatars, category badges"
```

---

## Task 11: Group Detail Page with Tabs

**Files:**
- Create: `app/(dashboard)/groups/[id]/page.tsx`
- Create: `components/groups/group-detail-client.tsx`
- Create: `actions/group-detail.ts`

**Step 1: Create the server action for group detail**

Create `actions/group-detail.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export type GroupDetailData = {
  group: {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    ownerId: string;
  };
  members: Array<{
    id: string;
    fullName: string;
    role: string;
  }>;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    expenseDate: Date;
    notes: string | null;
    payerId: string;
    payerName: string;
    createdAt: Date;
    splits: Array<{
      memberId: string;
      memberName: string;
      share: number;
    }>;
  }>;
  settlements: Array<{
    id: string;
    fromMember: string;
    fromName: string;
    toMember: string;
    toName: string;
    amount: number;
    settlementDate: Date;
    notes: string | null;
    createdAt: Date;
  }>;
};

export async function fetchGroupDetail(groupId: string): Promise<GroupDetailData> {
  const user = await getAuthenticatedUser();

  // Verify membership
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId, memberId: user.id } },
  });
  if (!membership) throw new Error("Not a member of this group");

  const [group, members, expenses, settlements] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { id: true, name: true, description: true, currency: true, ownerId: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      include: { member: { select: { id: true, fullName: true } } },
    }),
    prisma.expense.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, fullName: true } },
        splits: { include: { member: { select: { id: true, fullName: true } } } },
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      include: {
        from: { select: { id: true, fullName: true } },
        to: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    group,
    members: members.map((m) => ({
      id: m.member.id,
      fullName: m.member.fullName ?? "Unknown",
      role: m.role,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: parseFloat(String(e.amount)),
      expenseDate: e.expenseDate,
      notes: e.notes,
      payerId: e.payerId,
      payerName: e.payer.fullName ?? "Unknown",
      createdAt: e.createdAt,
      splits: e.splits.map((s) => ({
        memberId: s.memberId,
        memberName: s.member.fullName ?? "Unknown",
        share: parseFloat(String(s.share)),
      })),
    })),
    settlements: settlements.map((s) => ({
      id: s.id,
      fromMember: s.fromMember,
      fromName: s.from.fullName ?? "Unknown",
      toMember: s.toMember,
      toName: s.to.fullName ?? "Unknown",
      amount: parseFloat(String(s.amount)),
      settlementDate: s.settlementDate,
      notes: s.notes,
      createdAt: s.createdAt,
    })),
  };
}
```

**Step 2: Create the group detail page**

Create `app/(dashboard)/groups/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchGroupDetail } from "@/actions/group-detail";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let data;
  try {
    data = await fetchGroupDetail(id);
  } catch {
    redirect("/groups");
  }

  return <GroupDetailClient data={data} currentUserId={user.id} />;
}
```

**Step 3: Create the group detail client component**

Create `components/groups/group-detail-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  ArrowLeft,
  Settings,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { GroupDetailData } from "@/actions/group-detail";
import { AmountDisplay } from "@/components/ui/amount-display";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GroupDetailClientProps {
  data: GroupDetailData;
  currentUserId: string;
}

type TabId = "expenses" | "balances" | "activity";

function formatDateHeader(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d, yyyy");
}

export function GroupDetailClient({ data, currentUserId }: GroupDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("expenses");
  const [copied, setCopied] = useState(false);
  const { group, members, expenses, settlements } = data;

  const memberNames = members.map((m) => m.fullName);

  function handleCopyInvite() {
    const url = `${window.location.origin}/groups?join=${group.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  // Compute simplified balances
  const net: Record<string, number> = {};
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (expense.payerId === currentUserId && split.memberId !== currentUserId) {
        net[split.memberId] = (net[split.memberId] ?? 0) + split.share;
      } else if (expense.payerId !== currentUserId && split.memberId === currentUserId) {
        net[expense.payerId] = (net[expense.payerId] ?? 0) - split.share;
      }
    }
  }
  for (const s of settlements) {
    if (s.fromMember === currentUserId) {
      net[s.toMember] = (net[s.toMember] ?? 0) + s.amount;
    } else if (s.toMember === currentUserId) {
      net[s.fromMember] = (net[s.fromMember] ?? 0) - s.amount;
    }
  }
  const balanceList = Object.entries(net)
    .filter(([, amount]) => Math.abs(amount) > 0.01)
    .map(([memberId, amount]) => ({
      memberId,
      memberName: members.find((m) => m.id === memberId)?.fullName ?? "Unknown",
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Group expenses by date
  const expensesByDate = new Map<string, typeof expenses>();
  for (const expense of expenses) {
    const key = format(new Date(expense.expenseDate), "yyyy-MM-dd");
    if (!expensesByDate.has(key)) expensesByDate.set(key, []);
    expensesByDate.get(key)!.push(expense);
  }

  // Activity feed
  const activities = [
    ...expenses.map((e) => ({
      type: "expense" as const,
      text: `${e.payerId === currentUserId ? "You" : e.payerName} added "${e.description}" — ${formatCurrency(e.amount, group.currency)}`,
      date: new Date(e.createdAt),
    })),
    ...settlements.map((s) => ({
      type: "settlement" as const,
      text: `${s.fromMember === currentUserId ? "You" : s.fromName} settled ${formatCurrency(s.amount, group.currency)} with ${s.toMember === currentUserId ? "you" : s.toName}`,
      date: new Date(s.createdAt),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const tabs: { id: TabId; label: string }[] = [
    { id: "expenses", label: "Expenses" },
    { id: "balances", label: "Balances" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/groups"
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold truncate">{group.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <AvatarStack names={memberNames} max={4} size="sm" />
            <span className="text-xs text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyInvite}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Invite"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          {expenses.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="text-lg font-medium mb-1">No expenses yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first expense to this group
                </p>
                <Button asChild>
                  <Link href={`/expenses?create=true&group=${group.id}`}>Add expense</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            Array.from(expensesByDate.entries()).map(([dateKey, dayExpenses]) => (
              <div key={dateKey}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {formatDateHeader(new Date(dateKey))}
                </h3>
                <div className="space-y-2">
                  {dayExpenses.map((expense) => {
                    const myShare = expense.splits.find((s) => s.memberId === currentUserId)?.share ?? 0;
                    const iPaid = expense.payerId === currentUserId;
                    return (
                      <Card key={expense.id} className="py-4">
                        <CardContent className="py-0">
                          <div className="flex items-center gap-3">
                            <CategoryBadge />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{expense.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {iPaid ? "You" : expense.payerName} paid
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <AmountDisplay
                                amount={expense.amount}
                                currency={group.currency}
                                className="text-sm font-semibold text-foreground"
                              />
                              {myShare > 0 && (
                                <p className={cn(
                                  "text-xs font-medium",
                                  iPaid ? "text-success" : "text-destructive"
                                )}>
                                  {iPaid ? `You get back ${formatCurrency(expense.amount - myShare, group.currency)}` : `You owe ${formatCurrency(myShare, group.currency)}`}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "balances" && (
        <div className="space-y-3">
          {balanceList.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-lg font-medium mb-1">All settled up!</p>
                <p className="text-sm text-muted-foreground">
                  No outstanding balances in this group
                </p>
              </CardContent>
            </Card>
          ) : (
            balanceList.map((b) => (
              <Card key={b.memberId} className="py-4">
                <CardContent className="py-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.memberName}</p>
                      <p className={cn(
                        "text-xs",
                        b.amount > 0 ? "text-success" : "text-destructive"
                      )}>
                        {b.amount > 0 ? "owes you" : "you owe"}
                      </p>
                    </div>
                    <AmountDisplay
                      amount={b.amount}
                      currency={group.currency}
                      className="text-base font-bold"
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-3">
          {activities.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </CardContent>
            </Card>
          ) : (
            activities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className={cn(
                  "mt-1 h-2 w-2 rounded-full shrink-0",
                  activity.type === "expense" ? "bg-primary" : "bg-success"
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.date, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Verify**

Navigate to a group from the dashboard. Should see header with back button, member avatars, invite copy. Tabs should switch between expenses (date-grouped), balances (simplified debts), and activity feed.

**Step 5: Commit**

```bash
git add app/(dashboard)/groups/[id]/page.tsx components/groups/group-detail-client.tsx actions/group-detail.ts
git commit -m "feat: add group detail page with expenses, balances, and activity tabs"
```

---

## Task 12: Restyle Groups List Page

**Files:**
- Modify: `components/groups/group-list.tsx`

**Step 1: Update group list styling**

In `components/groups/group-list.tsx`, make these targeted changes:

1. Replace all `bg-indigo-600` with `bg-primary` and `text-indigo-` with `text-primary`
2. Replace `bg-amber-100 text-amber-600` (crown badge) with `bg-primary/10 text-primary`
3. Make group cards clickable links to `/groups/[id]` — wrap each card in a Link
4. Add hover effect: `hover:shadow-md hover:-translate-y-0.5 transition-all`

This is a targeted restyle — keep the existing create/edit/delete modal functionality intact.

**Step 2: Commit**

```bash
git add components/groups/group-list.tsx
git commit -m "feat: restyle groups list — emerald theme, clickable cards linking to detail"
```

---

## Task 13: Restyle Expenses List & Form

**Files:**
- Modify: `components/expenses/expense-list.tsx`
- Modify: `components/expenses/expense-form.tsx`

**Step 1: Update expense list styling**

In `components/expenses/expense-list.tsx`:
1. Replace all `bg-indigo-` and `text-indigo-` with `bg-primary` / `text-primary`
2. Add `CategoryBadge` import and render it next to each expense description
3. Wrap amounts with `font-mono` class
4. Update card styling to `rounded-2xl`

**Step 2: Update expense form styling**

In `components/expenses/expense-form.tsx`:
1. Replace `bg-indigo-` with `bg-primary`
2. Add `font-mono` class to amount input
3. Update button colors to primary

**Step 3: Commit**

```bash
git add components/expenses/expense-list.tsx components/expenses/expense-form.tsx
git commit -m "feat: restyle expenses — category badges, mono amounts, emerald theme"
```

---

## Task 14: Restyle Settings Page

**Files:**
- Modify: `components/settings/settings-client.tsx`

**Step 1: Update settings styling**

In `components/settings/settings-client.tsx`:
1. Replace all `bg-indigo-` and `text-indigo-` with `bg-primary` / `text-primary`
2. Group settings into clearly labeled sections with section headings
3. Update card styling

**Step 2: Commit**

```bash
git add components/settings/settings-client.tsx
git commit -m "feat: restyle settings page — emerald theme, section grouping"
```

---

## Task 15: Remove Standalone Settlements Page

**Files:**
- Modify: `app/(dashboard)/settlements/page.tsx` — convert to redirect

**Step 1: Replace settlements page with redirect**

Since settlements now live inside group detail, redirect the old route. Replace `app/(dashboard)/settlements/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function SettlementsPage() {
  redirect("/groups");
}
```

Keep `components/settlements/settlement-list.tsx` and `components/settlements/settlement-form.tsx` for now — they may be reused in group detail later. Just remove them from the nav.

**Step 2: Commit**

```bash
git add app/(dashboard)/settlements/page.tsx
git commit -m "feat: redirect /settlements to /groups — settlements moved to group detail"
```

---

## Task 16: Final Verification & Cleanup

**Step 1: Full app walkthrough**

Run `npm run dev` and test every screen:
- [ ] Login page: split layout on desktop, brand header on mobile
- [ ] Signup page: same layout
- [ ] Dashboard: 3 balance cards, group grid with avatars, recent expenses
- [ ] Groups list: clickable cards, emerald theme
- [ ] Group detail: tabs work (expenses, balances, activity)
- [ ] Expenses page: category badges, mono amounts
- [ ] Settings: restyled sections
- [ ] Sidebar: 4 items, collapsible, emerald active
- [ ] Mobile nav: raised center Add button, 5 tabs
- [ ] Dark mode: all screens render correctly
- [ ] `/settlements` redirects to `/groups`

**Step 2: Fix any TypeScript or build errors**

Run: `npx tsc --noEmit` to check for type errors.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and verify UI redesign"
```

---

## Summary of Implementation Order

| Task | Description | Files | Estimated Effort |
|------|-------------|-------|----------|
| 1 | Design tokens & fonts | globals.css, layout.tsx | Foundation |
| 2 | Category helpers | lib/categories.ts | Small |
| 3 | UI primitives | button, card, input | Small |
| 4 | Shared components | AmountDisplay, AvatarStack, CategoryBadge | Medium |
| 5 | Sidebar redesign | sidebar.tsx | Medium |
| 6 | Header simplification | header.tsx | Small |
| 7 | Mobile nav | mobile-nav.tsx | Small |
| 8 | Dashboard layout | layout.tsx | Small |
| 9 | Auth layout & pages | auth layout, login, signup | Medium |
| 10 | Dashboard redesign | dashboard-client, dashboard action, loading | Large |
| 11 | Group detail page | new route, client, server action | Large |
| 12 | Groups list restyle | group-list.tsx | Medium |
| 13 | Expenses restyle | expense-list, expense-form | Medium |
| 14 | Settings restyle | settings-client.tsx | Small |
| 15 | Remove settlements page | settlements/page.tsx | Small |
| 16 | Final verification | All | Verification |
