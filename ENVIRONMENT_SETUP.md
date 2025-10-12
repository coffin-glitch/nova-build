# Environment Setup Guide

## Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Database Configuration
# For production, use your Supabase PostgreSQL URL
# For development, you can use SQLite (local) or PostgreSQL
DATABASE_URL=postgresql://username:password@localhost:5432/nova_build

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

### Option 1: PostgreSQL (Recommended for Production)
- Use Supabase, Railway, or any PostgreSQL provider
- Set `DATABASE_URL` to your PostgreSQL connection string

### Option 2: SQLite (Development Only)
- The app will automatically use SQLite if no `DATABASE_URL` is set
- Database file will be created at `storage/nova-build.db`

## After Setup

1. Restart your development server: `npm run dev`
2. The sign-in button should now work properly
3. You can create an account and test authentication

