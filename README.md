# SplitEase

A modern expense splitting app built with Next.js, Prisma, and Supabase.

## Features

- **Groups** - Create groups, add members, manage roles
- **Expenses** - Track shared expenses with equal or custom splits
- **Settlements** - Record payments between members
- **Dashboard** - View balances, recent activity, and group summaries
- **Dark Mode** - Full light/dark theme support
- **Data Export/Import** - Backup and restore your data as JSON

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions)
- **Database**: Supabase PostgreSQL via Prisma ORM
- **Auth**: Supabase Auth with cookie-based sessions
- **UI**: shadcn/ui + Tailwind CSS v4
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project with the database schema applied

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

### Install & Run

```bash
npm install
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
├── (auth)/          # Login & signup pages
├── (dashboard)/     # Authenticated pages
│   ├── expenses/    # Expense management
│   ├── groups/      # Group management
│   ├── settings/    # User settings & backup
│   └── settlements/ # Settlement tracking
actions/             # Server actions (CRUD)
components/          # React components
lib/                 # Utilities, Prisma, Supabase clients
prisma/              # Database schema
```
