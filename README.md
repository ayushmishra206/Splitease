# SplitEase

A modern expense splitting app built with Next.js, Neon PostgreSQL, and Prisma. Split bills with friends and family, track who owes what, and settle up with minimal payments.

## Features

### Expense Management
- **Group Expense Tracking** - Create groups and track shared expenses with multiple split types (equal, percentage, shares, exact)
- **8 Expense Categories** - Categorize expenses with emoji and color coding
- **Receipt Upload** - Attach receipt images to expenses via Uploadthing
- **Recurring Expenses** - Set up recurring expenses with cron-based auto-creation
- **Creator-Only Edit/Delete** - Only the expense creator can modify or remove an expense
- **Cursor-based Pagination** - Efficient paginated expense lists with filtering

### Settlements & Debt
- **Debt Simplification** - Greedy debt simplification algorithm to minimize the number of payments
- **Settle-up Flow** - Record payments between members with suggested settlements

### Groups
- **Group Management** - Create, update, and manage expense groups
- **Member Search & Invite** - Search for users and add them to groups with email notifications
- **Role-based Permissions** - Group owners control settings, members, and archival
- **Group Archive/Restore** - Archive inactive groups and restore them later
- **Activity Log** - Track all expense and settlement activity within each group

### Analytics & Data
- **Analytics Dashboard** - Spending charts, category breakdowns, and group comparison analytics via Recharts
- **Data Export/Import** - Export human-readable JSON backups and restore from them

### Authentication & Security
- **Authentication** - Google OAuth and email/password authentication via NextAuth.js v5
- **Password Reset** - Email-based forgot password flow with rate limiting and secure tokens
- **Set Password for OAuth** - Google users can set a password to also sign in with email
- **Change Password** - Update password from settings (current password verified for existing passwords)

### Notifications
- **Browser Push Notifications** - Real-time push notifications for new expenses, settlements, and group invites
- **Email Notifications** - Email alerts for group invites, new expenses, settlements, and password resets via Resend

### UI & Experience
- **Responsive Mobile Design** - Mobile-first layout with bottom navigation and safe area support
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

### Google OAuth Setup

To enable Google sign-in locally, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in your [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

### Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add the environment variables above (set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your production URL)
4. Deploy

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
lib/                     # Utilities, Prisma client, email templates, helpers
prisma/                  # Database schema
public/                  # Static assets, service worker
types/                   # TypeScript type definitions
```

## License

MIT
