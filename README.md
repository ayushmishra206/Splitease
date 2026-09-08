# SplitEase

A modern expense splitting app built with Next.js, Neon PostgreSQL, and Prisma. Split bills with friends and family, track who owes what, and settle up with minimal payments.

## Features

### Expense Management
- **Group Expense Tracking** - Create groups and track shared expenses with multiple split types (equal, percentage, shares, exact)
- **Multiple Payers** - Record an expense paid by two or three people with the amount each contributed (Splitwise-style)
- **Group Totals** - Total spent, your share, what you paid and your balance for every group
- **8 Expense Categories** - Categorize expenses with emoji and color coding
- **Receipt Upload** - Attach or photograph receipt images via Uploadthing
- **Recurring Expenses** - Set up recurring expenses with cron-based auto-creation
- **Shared Editing** - Any group member can edit an expense; the person who added it is notified. Deleting is limited to the creator, a payer, or the group owner
- **Cursor-based Pagination** - Efficient paginated expense lists with filtering

### Settlements & Debt
- **Debt Simplification** - Greedy debt simplification algorithm to minimize the number of payments
- **Settle-up Flow** - Record payments between members with suggested settlements

### Groups
- **Group Management** - Create, update, and manage expense groups
- **Member Search & Invite** - Search for users and add them to groups with email notifications
- **Role-based Permissions** - Group owners control settings, members, and archival
- **Group Archive/Restore** - Archive inactive groups and restore them later
- **Leave Group / Safe Removal** - Members can only leave or be removed once their balance is settled
- **Activity Log** - Track all expense and settlement activity within each group

### Analytics & Data
- **Analytics Dashboard** - Spending charts, category breakdowns, and group comparison analytics via Recharts
- **Data Export/Import** - Export readable JSON backups (with stable ids) and restore them

### Authentication & Security
- **Authentication** - Google OAuth and email/password authentication via NextAuth.js v5
- **Password Reset** - Email-based forgot password flow with rate limiting and secure tokens
- **Set Password for OAuth** - Google users can set a password to also sign in with email
- **Change Password** - Update password from settings (current password verified for existing passwords)

### Notifications
- **Browser Push Notifications** - Real-time push notifications for new expenses, settlements, and group invites
- **Email Notifications** - Email alerts for group invites, new expenses, settlements, and password resets via Resend

### UI & Experience
- **Mobile-first** - Bottom navigation with a one-tap "Add expense" sheet, bottom-sheet dialogs, decimal keypads, camera receipt capture, and iOS safe-area support
- **Dark Mode** - Full light/dark theme support via next-themes

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions)
- **Language**: TypeScript
- **Database**: Neon PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5 with Credentials + Google OAuth
- **UI**: shadcn/ui (Radix UI) + Tailwind CSS v4
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Toasts**: Sonner
- **File Uploads**: Uploadthing
- **Push Notifications**: web-push (Web Push API + Service Worker)
- **Email**: Resend
- **Theme**: next-themes
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database

### Environment Variables

Create a `.env.local` file:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Auth (NextAuth.js)
AUTH_SECRET="your-auth-secret"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# File Uploads (Uploadthing)
UPLOADTHING_TOKEN="your-uploadthing-token"

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"
EMAIL_FROM="YourApp <hello@yourdomain.com>"

# Cron Jobs
CRON_SECRET="your-cron-secret"
```

### Install & Run

```bash
npm install
npx prisma db push
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Upgrading an existing database

Multi-payer support adds one table, `expense_payers`. Run `npm run db:push`
after pulling. No backfill is needed: expenses without payer rows are treated as
paid in full by their `payer_id`. See `docs/audit/2026-09-08-code-and-ux-audit.md`
for the optional backfill SQL and the full audit.

If you cannot run the Prisma CLI against the database (for example, you only
have the Neon SQL editor), apply
[`prisma/sql/2026-09-08-add-expense-payers.sql`](prisma/sql/2026-09-08-add-expense-payers.sql)
instead. It is idempotent and leaves the database in sync with the Prisma schema.

A database missing this table makes every page that reads expenses — dashboard,
expenses, groups, group detail and analytics — fail with a Server Components
render error, because Prisma raises `P2021: The table public.expense_payers does
not exist in the current database`.

### Quality checks

```bash
npm run lint
npx tsc --noEmit
npm test
```

### Google OAuth Setup

To enable Google sign-in locally, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in your [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

### Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add the environment variables above (set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your production URL)
4. Deploy

`npm run build` runs `prisma db push` before `next build`, so a deploy applies
any schema change along with the code that needs it. Two consequences worth
knowing:

- `DATABASE_URL` and `DIRECT_URL` must be set for the build, not just at runtime.
- `db push` is deliberately run without `--accept-data-loss`. A deploy of a
  commit whose schema would drop a column or table fails the build instead of
  destroying data — including a rollback to a commit older than a schema change.
  Apply such a change to the database by hand first.

## Project Structure

```
app/
├── (auth)/              # Login, signup, forgot/reset password pages
├── (dashboard)/         # Authenticated pages
│   ├── analytics/       # Spending analytics dashboard
│   ├── expenses/        # Expense management
│   ├── groups/          # Group management & detail
│   ├── settings/        # User settings, password, notifications, backup
│   └── settlements/     # Settlement tracking
├── api/
│   ├── auth/            # NextAuth API routes
│   ├── cron/            # Recurring expense cron endpoint
│   └── uploadthing/     # File upload routes
actions/                 # Server actions (expenses, groups, settlements, auth, etc.)
components/              # React components (UI, layout, forms, charts)
docs/                    # Product docs, plans and audits
lib/                     # Utilities, validation, money/date helpers, Prisma client, email
prisma/                  # Database schema
public/                  # Static assets, service worker
types/                   # TypeScript type definitions
__tests__/               # Vitest unit tests for libraries and server actions
```

## License

MIT
