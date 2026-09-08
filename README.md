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

Run `npm run db:apply` after pulling. It applies the SQL patches in
[`prisma/sql/`](prisma/sql), which only ever add to the database and are safe to
re-run. Multi-payer support adds one table, `expense_payers`; no backfill is
needed, since expenses without payer rows are treated as paid in full by their
`payer_id`. See `docs/audit/2026-09-08-code-and-ux-audit.md` for the optional
backfill SQL and the full audit.

Without the Prisma CLI (for example, with only the Neon SQL editor), paste the
files in `prisma/sql/` in filename order instead. They are plain, idempotent SQL.

A database missing `expense_payers` makes every page that reads expenses —
dashboard, expenses, groups, group detail and analytics — fail with a Server
Components render error, because Prisma raises `P2021: The table
public.expense_payers does not exist in the current database`.

#### Why patches instead of `prisma db push`

`db push` makes the database *match* `schema.prisma`, so it insists on dropping
anything the schema no longer describes. The production database holds a
`users.auth_provider` column and a `rate_limit_attempts` table that nothing in
this repo references, so `db push` there fails with a data-loss error and cannot
be used unattended. `npm run db:push` is still fine against a database you know
matches the schema, such as a fresh local one.

That drift is worth reconciling deliberately at some point: either restore the
two objects to `schema.prisma` if they are still wanted, or drop them once you
are sure nothing depends on them.

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

`npm run build` runs `scripts/db-sync.mjs` between `prisma generate` and
`next build`, so a **production** deploy applies the patches in `prisma/sql/`
along with the code that needs them. It is deliberately narrow:

- Only Vercel production deploys apply patches. Preview deploys share the
  production database, so patching from them would let an unmerged branch reshape
  it. Local and CI builds do nothing — use `npm run db:apply`.
- Without `DATABASE_URL` and `DIRECT_URL` at build time it warns and skips, so it
  can never turn a deploy that used to succeed into a failed one. Set both for the
  Build environment in Vercel if you want production deploys to apply patches.
- A patch that errors fails the build, rather than shipping code whose tables are
  missing. `SKIP_DB_SYNC=1` opts a deploy out.

### Adding a schema change

1. Edit `prisma/schema.prisma`.
2. Add an idempotent patch to `prisma/sql/`, named with a leading date so it
   sorts after the existing ones — guard it with `IF NOT EXISTS`, or a
   `DO $$ ... END $$` block that checks a catalog first. Patches re-run on every
   deploy, and must never drop anything.
3. Apply it locally with `npm run db:apply`, then `npx prisma generate`.

Ship the patch in the same commit as the code that needs it; the deploy applies
it before the build.

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
