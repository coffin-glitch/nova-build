# Environment Setup Guide

## Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Database Configuration
# REQUIRED: PostgreSQL Database URL
# For local development with PostgreSQL:
DATABASE_URL=postgresql://postgres:password@localhost:5432/nova_build

# For production with Supabase:
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/[database]

# Clerk Authentication
# Get these from your Clerk dashboard: https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Optional: Base URL for API calls
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Development settings
NODE_ENV=development
```

## Getting Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your project or create a new one
3. Go to "API Keys" section
4. Copy the Publishable Key and Secret Key
5. Paste them into your `.env.local` file

## Database Setup

### PostgreSQL Setup (Required)

**Option 1: Local PostgreSQL**
1. Install PostgreSQL on your machine
2. Create a database: `createdb nova_build`
3. Set `DATABASE_URL=postgresql://postgres:password@localhost:5432/nova_build`

**Option 2: Supabase (Recommended)**
1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Copy the database URL from Settings > Database
4. Set `DATABASE_URL` to your Supabase connection string

**Option 3: Other PostgreSQL Providers**
- Railway, Neon, PlanetScale, etc.
- Use their provided connection string

### Database Migration

After setting up your database, run the migration:

```bash
# Run the complete schema migration
psql $DATABASE_URL -f db/migrations/012_complete_postgres_schema.sql
```

## After Setup

1. Restart your development server: `npm run dev`
2. The application will now use PostgreSQL exclusively
3. All API endpoints will work with the PostgreSQL database
4. You can create an account and test authentication

## Troubleshooting

**"DATABASE_URL environment variable is not set!" error:**
- Make sure you have a `.env.local` file in your project root
- Check that the DATABASE_URL is correctly formatted
- Restart your development server after adding the environment variable

**Database connection errors:**
- Verify your PostgreSQL server is running
- Check that the database exists
- Ensure the connection string is correct
- Run the migration script to create tables

