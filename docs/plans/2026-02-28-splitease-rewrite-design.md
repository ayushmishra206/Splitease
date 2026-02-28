# SplitEase — Next.js Rewrite Design Document

**Date:** 2026-02-28
**Status:** Approved
**Author:** Ayush + Claude

---

## 1. Overview

Rewrite SplitWisely as **SplitEase** using Next.js 15 (App Router), Prisma ORM, shadcn/ui, and Tailwind CSS. Keep Supabase as the backend (PostgreSQL + Auth). Deploy on Vercel instead of GitHub Pages.

**Scope:** Feature parity with the current SplitWisely app:
- Authentication (email/password via Supabase Auth)
- Groups (CRUD, member management)
- Expenses (CRUD, equal splits)
- Settlements (CRUD)
- Dashboard (balances overview)
- Settings (profile, theme, data export/import)
- Dark mode

---

## 2. Architecture

### Approach: Prisma + Supabase Auth

- **Prisma** for type-safe database access (connected to Supabase PostgreSQL)
- **Supabase Auth** (`@supabase/ssr`) for authentication and session management
- **Server Components** for data fetching (no client-side loading spinners for initial page loads)
- **Server Actions** for all mutations (create, update, delete)
- **Client Components** only where interactivity is needed (forms, modals, theme toggle)
- **RLS** remains enabled as defense-in-depth

### Why This Approach

- Type-safe DB access via Prisma generated client
- Server Components eliminate client-side data fetching waterfalls
- Supabase Auth is already configured with RLS policies — zero auth migration
- Clean separation: Prisma = data layer, Supabase = auth layer
- Aligns with PRD tech stack recommendation

---

## 3. Project Structure

```
splitease/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx                  # Centered auth layout (gradient bg)
│   ├── (dashboard)/
│   │   ├── page.tsx                    # Dashboard (/)
│   │   ├── groups/
│   │   │   ├── page.tsx                # Groups list
│   │   │   └── [id]/page.tsx           # Group detail view
│   │   ├── expenses/page.tsx           # Expenses list
│   │   ├── settlements/page.tsx        # Settlements list
│   │   ├── settings/page.tsx           # User settings
│   │   └── layout.tsx                  # Sidebar + header + mobile nav
│   ├── layout.tsx                      # Root: html, body, fonts, ThemeProvider
│   └── globals.css                     # Tailwind imports + shadcn vars
├── components/
│   ├── ui/                             # shadcn/ui primitives (Button, Card, etc.)
│   ├── expenses/
│   │   ├── expense-form.tsx            # Create/edit expense (Client Component)
│   │   ├── expense-list.tsx            # Expense table/cards
│   │   └── expense-delete-button.tsx
│   ├── groups/
│   │   ├── group-form.tsx
│   │   ├── group-list.tsx
│   │   └── group-member-manager.tsx
│   ├── settlements/
│   │   ├── settlement-form.tsx
│   │   └── settlement-list.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       ├── mobile-nav.tsx
│       └── theme-toggle.tsx
├── lib/
│   ├── prisma.ts                       # Prisma client singleton
│   ├── supabase/
│   │   ├── server.ts                   # createServerClient() for Server Components
│   │   ├── client.ts                   # createBrowserClient() for Client Components
│   │   └── middleware.ts               # Auth session refresh helper
│   └── utils.ts                        # cn() helper, formatCurrency, etc.
├── actions/
│   ├── auth.ts                         # signIn, signUp, signOut actions
│   ├── expenses.ts                     # CRUD server actions
│   ├── groups.ts                       # CRUD server actions
│   └── settlements.ts                  # CRUD server actions
├── prisma/
│   └── schema.prisma                   # Introspected from Supabase
├── middleware.ts                        # Next.js middleware (auth guard)
├── next.config.ts
├── tailwind.config.ts
├── components.json                     # shadcn/ui config
├── .env.local                          # Environment variables
└── package.json
```

---

## 4. Data Layer — Prisma Schema

Introspected from the existing Supabase database (`prisma db pull`). Key models:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Supabase pooled connection (Transaction mode)
  directUrl = env("DIRECT_URL")         // Direct connection for migrations
}

generator client {
  provider = "prisma-client-js"
}

model Profile {
  id        String   @id @db.Uuid
  fullName  String?  @map("full_name")
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

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
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @default(now()) @map("updated_at") @db.Timestamptz

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
  joinedAt DateTime @default(now()) @map("joined_at") @db.Timestamptz

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
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @default(now()) @map("updated_at") @db.Timestamptz

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
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  group Group   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  from  Profile @relation("SettlementFrom", fields: [fromMember], references: [id], onDelete: Cascade)
  to    Profile @relation("SettlementTo", fields: [toMember], references: [id], onDelete: Cascade)

  @@map("settlements")
}
```

---

## 5. Authentication Flow

```
Browser request
  → middleware.ts (Next.js middleware)
    → createServerClient() from @supabase/ssr
    → Refresh session token if needed
    → Check if authenticated:
        ├─ No session + protected route → redirect to /login
        └─ Has session → continue to Server Component
            → getUser() to get authenticated user ID
            → Prisma queries filter by userId
```

**Middleware** runs on every request to `/` (dashboard routes). Auth pages (`/login`, `/signup`) are excluded. The middleware refreshes expired tokens automatically.

**Server Actions** re-verify the user session before every mutation:
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error('Unauthorized')
```

---

## 6. Data Flow Patterns

### Reading Data (Server Components)
```
Page renders on server
  → getUser() from Supabase session
  → prisma.expense.findMany({ where: { group: { members: { some: { memberId: user.id } } } } })
  → Render HTML with data
  → Stream to browser (no loading states needed)
```

### Writing Data (Server Actions)
```
Client Component form submit
  → Server Action (actions/expenses.ts)
  → Validate with Zod
  → Get user from Supabase session
  → Prisma create/update/delete
  → revalidatePath() to refresh page data
  → Return result to client
```

---

## 7. Branding — SplitWisely → SplitEase

| Element | Old | New |
|---------|-----|-----|
| App name | SplitWisely | SplitEase |
| Tagline | Plan. Split. Settle. | Split expenses, not friendships. |
| Logo badge text | SW | SE |
| Package name | splitwisely | splitease |
| Theme storage key | splitwisely:theme | splitease:theme |
| Auth storage key | splitwisely-auth | splitease-auth |
| Backup filename | splitwisely-backup-*.json | splitease-backup-*.json |
| Primary color | Indigo 600 | Indigo 600 (keep) |
| Favicon | S lettermark | SE lettermark |

---

## 8. Deployment — Vercel

- **Hosting:** Vercel (automatic from GitHub push)
- **Build:** `prisma generate && next build`
- **Environment variables:**
  - `DATABASE_URL` — Supabase pooled connection string
  - `DIRECT_URL` — Supabase direct connection string
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- **Preview deployments:** Automatic per PR
- **Cleanup:** Remove `.github/workflows/deploy.yml` and `CNAME` file

---

## 9. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| ORM | Prisma |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (@supabase/ssr) |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS 3 |
| Forms | React Hook Form + Zod |
| Deployment | Vercel |
| Package Manager | npm |

---

## 10. What's NOT in Scope (Future Phases)

These PRD features will be added after feature parity is achieved:
- Invite links for groups
- Debt simplification algorithm
- Activity feed
- Split by percentage/exact amounts/shares
- Expense categories and tags
- Receipt image upload
- Notifications
- Multi-currency support
- Recurring expenses
- Analytics and charts
- Payment gateway integration
- PWA support
