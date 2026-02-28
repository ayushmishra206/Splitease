# SplitEase

A modern expense splitting app built with Next.js, Neon PostgreSQL, and Prisma.

## Features

- **Group Expense Tracking** - Create groups and track shared expenses with multiple split types (equal, percentage, shares, exact)
- **Debt Simplification** - Automatic debt simplification algorithm to minimize the number of payments
- **Settle-up Flow** - Record payments between members with suggested settlements
- **8 Expense Categories** - Categorize expenses with emoji and color coding
- **Receipt Upload** - Attach receipt images to expenses via Uploadthing
- **Recurring Expenses** - Set up recurring expenses with cron-based auto-creation
- **Analytics Dashboard** - Spending charts and group comparison analytics via Recharts
- **Browser Push Notifications** - Real-time notifications for new expenses and settlements
- **Email Notifications** - Email alerts via Resend
- **Group Archive/Restore** - Archive inactive groups and restore them later
- **Data Export/Import** - Backup and restore your data as JSON
- **Cursor-based Pagination** - Efficient paginated expense lists
- **Dark Mode** - Full light/dark theme support
- **Authentication** - Google OAuth and credentials-based authentication via NextAuth.js v5

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions)
- **Language**: TypeScript
- **Database**: Neon PostgreSQL (Singapore, `ap-southeast-1`) + Prisma ORM
- **Auth**: NextAuth.js v5 (beta) with Credentials + Google OAuth providers
- **UI**: shadcn/ui (radix-ui) + Tailwind CSS v4
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Toasts**: Sonner
- **File Uploads**: Uploadthing
- **Push Notifications**: web-push (Web Push API)
- **Email**: Resend
- **Theme**: next-themes (dark mode support)
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
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# File Uploads (Uploadthing)
UPLOADTHING_TOKEN="your-uploadthing-token"

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"

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

### Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add the environment variables above
4. Deploy

## Project Structure

```
app/
├── (auth)/              # Login & signup pages
├── (dashboard)/         # Authenticated pages
│   ├── analytics/       # Spending analytics dashboard
│   ├── expenses/        # Expense management
│   ├── groups/          # Group management
│   ├── settings/        # User settings & backup
│   └── settlements/     # Settlement tracking
├── api/
│   ├── auth/            # NextAuth API routes
│   ├── cron/            # Cron job endpoints
│   └── uploadthing/     # File upload routes
actions/                 # Server actions (CRUD)
components/              # React components
lib/                     # Utilities, Prisma client, helpers
prisma/                  # Database schema
types/                   # TypeScript type definitions
```

## License

MIT
