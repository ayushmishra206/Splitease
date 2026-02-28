# SplitEase UI Redesign — Design Document

**Date:** 2026-02-28
**Status:** Approved
**Approach:** Component-First Retheme (Approach A)

---

## Scope

Visual overhaul of all existing screens (dashboard, groups, expenses, settings, auth) plus structural changes to navigation and layout. New screens (analytics, notifications) deferred to a follow-up phase.

### What's Included
- New color palette, typography, spacing, and shadow tokens
- Layout restructure: sidebar, header, mobile nav, auth layout
- Page redesigns: dashboard, group detail (new route), expenses, settings, auth
- Component restyling: buttons, cards, inputs, badges, avatars, toasts, skeletons
- Expense category emoji badges (UI-only, no DB migration)
- Essential animations: button press feedback, skeleton loaders

### What's Deferred
- Analytics page, notifications panel, settle-up flow with confetti
- Category DB migration (column + picker persistence)
- Count-up number transitions, card entry animations
- Social login buttons (Google, GitHub)
- Framer-motion dependency

---

## 1. Design Tokens

### Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#10B981` (emerald) | `#34D399` | Brand, nav active, positive actions |
| `--primary-foreground` | `#FFFFFF` | `#022C22` | Text on primary |
| `--accent` | `#F97316` (coral) | `#FB923C` | CTAs, "you owe" indicators |
| `--accent-foreground` | `#FFFFFF` | `#431407` | Text on accent |
| `--success` | `#22C55E` | `#4ADE80` | "You are owed", settled states |
| `--destructive` | `#EF4444` | `#F87171` | Negative balances, delete |
| `--background` | `#F8FAFC` | `#0F172A` | Page background |
| `--card` | `#FFFFFF` | `#1E293B` | Card surfaces |
| `--muted` | `#F1F5F9` | `#334155` | Subtle backgrounds |
| `--border` | `#E2E8F0` | `#334155` | Borders |
| `--foreground` | `#0F172A` | `#F8FAFC` | Primary text |
| `--muted-foreground` | `#64748B` | `#94A3B8` | Secondary text |

### Typography

- **Headings & body:** Inter (already loaded)
- **Currency amounts:** JetBrains Mono via `next/font/google`, assigned to `--font-mono`
- **Scale:** Tailwind defaults (12/14/16/20/24/32/40px)

### Spacing & Radius

- Tailwind's 4px system (p-4 = 16px, p-6 = 24px)
- Card radius: `rounded-2xl` (16px)
- Button/input radius: `rounded-xl` (12px)
- Card shadows: `shadow-sm` default, `shadow-md` on hover

### Button Press Feedback

All interactive buttons and cards: `active:scale-[0.97] transition-transform duration-100`

---

## 2. Layout & Navigation

### Sidebar (Desktop)

- Width: 240px expanded, 64px collapsed (toggle chevron at bottom)
- Background: `--card` with subtle right border
- 4 nav items: Dashboard, Groups, Expenses, Settings
- Active state: pill with `primary/10` background + primary text
- Inactive: `--muted-foreground` text, hover `--muted` background
- Bottom: user avatar + name + dropdown (sign out, theme toggle)
- Top: SplitEase logo + "Split smart. Stay even." tagline

### Mobile Bottom Nav

- 5 tabs: Home, Groups, **Add** (center raised), Expenses, Settings
- Center Add: raised circle, `--primary` bg, white `+` icon, `-mt-4`, `shadow-lg`
- Tapping Add opens bottom sheet / modal for quick expense creation
- Active: primary color icon + label. Inactive: muted-foreground

### Header

- **Desktop:** Page title (left) + "Add Expense" CTA button (right)
- **Mobile:** Page title (left) + user avatar circle (right)
- Remove: date display, user info pill, sign out button, theme toggle

### Auth Layout

- **Desktop:** Split 50/50 — left brand panel (emerald gradient + logo + tagline), right form
- **Mobile:** Compact brand header (~80px) + full-width form card

### Content Area

- Background: `--background`
- Max width: `max-w-5xl` (1024px)
- Padding: `px-6 py-8` desktop, `px-4 py-6` mobile

---

## 3. Page Redesigns

### Dashboard (`/`)

**Top: 3 Balance Cards (row)**
- "Total You Owe" — accent/coral tinted background, coral icon
- "Total Owed to You" — success green tinted background, green icon
- "Net Balance" — primary tint if positive, accent tint if negative
- Amounts in JetBrains Mono, `text-2xl font-bold`
- Mobile: stack vertically or 2+1 grid

**Middle: Groups Grid**
- 2 columns desktop, 1 column mobile
- Each card: group emoji/initial avatar, group name, stacked member avatar pills (max 3 + "+N"), net balance (green/red/gray), last activity relative timestamp
- Cards link to `/groups/[id]`
- Hover: shadow increase + slight translateY
- Empty state: illustration + "Create your first group" CTA

**Bottom: Recent Expenses**
- 5-item list with emoji category badges
- Amounts in JetBrains Mono
- "View all" link in `--primary`

### Group Detail (`/groups/[id]` — new route)

**Header:**
- Back arrow → `/groups`
- Group emoji + name (inline editable for owner)
- Member avatar stack
- Invite link copy button (toast confirmation)
- Settings gear icon

**Tabs:** Expenses | Balances | Activity (animated underline)

**Expenses Tab (default):**
- Chronological list grouped by date ("Today", "Yesterday", "Feb 25")
- Each row: emoji category badge, description, payer info, amount (mono), your share (green/red)
- Tap to expand: full split breakdown, notes, edit/delete

**Balances Tab:**
- Simplified debts: "You → Alice: ₹500" with avatars and amounts
- "Settle Up" button per debt row (primary outline)
- "All settled" state: checkmark + celebratory text

**Activity Tab:**
- Timeline feed with avatar + action text + timestamp
- Filter chips: All | Expenses | Settlements

### Expenses Page (`/expenses` — restyle)

- Keep existing grid, restyle with new tokens
- Add emoji category badges
- Filter bar: group dropdown + date range
- Amounts in JetBrains Mono

### Settings Page (`/settings` — restyle)

- Keep current functionality
- Restyle with new card design
- Group into sections: Profile, Preferences, Data

### Auth Pages (`/login`, `/signup` — restructure)

- Desktop: split layout (brand left, form right)
- Mobile: brand header + form
- Primary CTA: emerald instead of indigo
- Footer links between login/signup

---

## 4. Component Changes

### Buttons
- Primary: emerald fill (`--primary`), `active:scale-[0.97]`
- Destructive: red, unchanged behavior
- Outline/Ghost: muted-foreground border/text, hover primary/10 bg
- New "accent" variant: coral/orange fill

### Cards
- `rounded-2xl`, `shadow-sm`, `--card` background, `--border` 1px
- Interactive cards: `hover:shadow-md hover:-translate-y-0.5 transition-all`

### Inputs
- Focus ring: `ring-primary` (emerald)
- Currency input: symbol prefix, JetBrains Mono text

### Badges
- Category: emoji + colored pill
- Status: Settled (green), Pending (amber), Overdue (red)

### Amount Display Pattern
- Always `font-mono` (JetBrains Mono)
- Positive: `text-success`. Negative: `text-destructive`. Neutral: `text-foreground`

### Avatar Stacks
- Overlapping circles, max 3 visible, "+N" badge
- Sizes: sm (24px), md (32px)

### Skeleton Loaders
- Extend existing dashboard skeletons to group detail and expense list
- `--muted` background with pulse animation

### Toasts
- Keep Sonner, top-right position
- Success: `--success` color. Error: `--destructive`

---

## 5. Expense Categories (UI-Only)

| Category | Emoji | Color |
|----------|-------|-------|
| Food | 🍔 | orange |
| Rent | 🏠 | blue |
| Transport | 🚗 | yellow |
| Entertainment | 🎬 | purple |
| Groceries | 🛒 | green |
| Travel | ✈️ | teal |
| Utilities | 💡 | amber |
| Other | 📦 | gray |

- Category picker: horizontal scrollable emoji chips in expense form
- All existing expenses show default 📦 emoji
- No DB migration — category column deferred to follow-up

---

## 6. Structural Changes

### Route Changes
- **New:** `/groups/[id]` — group detail page with tabs
- **Remove:** `/settlements` as top-level route — settlements move into group detail Balances tab
- **Keep:** `/`, `/groups`, `/expenses`, `/settings`, `/login`, `/signup`

### Navigation Changes
- Sidebar: 4 items (Dashboard, Groups, Expenses, Settings)
- Mobile: 5 tabs (Home, Groups, Add, Expenses, Settings)
- Settlements accessible from: group detail Balances tab, dashboard "Settle up" links

### Server Action Changes
- Need a new `fetchGroupDetail(groupId)` action for the group detail page
- Existing `fetchDashboardData()` may need adjustment for group cards format
- Settlement actions remain but are called from group context instead of standalone page

---

## 7. Files Affected

### Modified
- `app/globals.css` — new color tokens
- `app/layout.tsx` — add JetBrains Mono font
- `app/(dashboard)/layout.tsx` — new layout structure
- `app/(dashboard)/page.tsx` — dashboard redesign
- `app/(dashboard)/groups/page.tsx` — restyle
- `app/(dashboard)/expenses/page.tsx` — restyle
- `app/(dashboard)/settings/page.tsx` — restyle
- `app/(auth)/layout.tsx` — split layout
- `app/(auth)/login/page.tsx` — restyle
- `app/(auth)/signup/page.tsx` — restyle
- `app/(dashboard)/loading.tsx` — update skeletons
- `components/ui/button.tsx` — new variants, press feedback
- `components/ui/card.tsx` — new radius/shadows
- `components/ui/input.tsx` — focus ring color
- `components/layout/sidebar.tsx` — full redesign
- `components/layout/header.tsx` — simplify
- `components/layout/mobile-nav.tsx` — raised center button
- `components/layout/theme-toggle.tsx` — keep mounted fix, restyle colors
- `components/dashboard/dashboard-client.tsx` — 3 balance cards + group grid
- `components/groups/group-list.tsx` — restyle cards
- `components/expenses/expense-list.tsx` — add category badges
- `components/expenses/expense-form.tsx` — category picker, mono amounts
- `components/settings/settings-client.tsx` — restyle sections
- `lib/utils.ts` — add category helpers

### New Files
- `app/(dashboard)/groups/[id]/page.tsx` — group detail page
- `components/groups/group-detail-client.tsx` — group detail tabs
- `components/ui/avatar-stack.tsx` — overlapping avatar component
- `components/ui/amount-display.tsx` — formatted currency with color coding
- `components/ui/category-badge.tsx` — emoji category badge
- `actions/groups-detail.ts` — fetchGroupDetail server action
- `lib/categories.ts` — category definitions and helpers

### Removed
- `app/(dashboard)/settlements/page.tsx` — merged into group detail
- `components/settlements/settlement-list.tsx` — functionality moves to group detail
