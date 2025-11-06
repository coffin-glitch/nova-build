# Complete .env.local Guide

## Quick Reference

Your `.env.local` file should contain all the variables listed below. Copy the template from `.env.local.example` and fill in your values.

---

## Required Variables (Must Have)

### 1. Supabase Authentication (Currently Active)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://rbiomzdrlmsexehrhowa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to get:**
- Supabase Dashboard → **Settings** → **API**
- Copy the **URL**, **anon/public key**, and **service_role key**

---

### 2. Auth Provider Configuration

```bash
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true
```

**Current Settings:**
- `AUTH_PROVIDER=supabase` - Use Supabase for authentication
- `NEXT_PUBLIC_USE_SUPABASE_AUTH=true` - Enable Supabase auth UI

---

### 3. Database Connection

```bash
DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require
```

**Where to get:**
- Supabase Dashboard → **Settings** → **Database** → **Connection Pooling**
- Use the **Transaction mode** pooler URL (port 6543)

**Optional Pool Tuning:**
```bash
PG_POOL_MAX=15
PG_IDLE_TIMEOUT=20
PG_CONNECT_TIMEOUT=30
PG_MAX_LIFETIME=1800
```

---

## Optional Variables (Conditional)

### Clerk (Legacy/Backup - Not Currently Used)

Only include if you want to keep Clerk as a backup or are still migrating:

```bash
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# CLERK_SECRET_KEY=sk_test_...
```

---

### EAX Portal Integration

Only if you're using the EAX load integration:

```bash
EAX_BASE_URL=https://eax.shiprrexp.com
EAX_USERNAME=your_username
EAX_PASSWORD=your_password
```

---

### Telegram Bot

Only if you're using Telegram bid forwarding:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
BOT_TOKEN=your_bot_token
TELEGRAM_SOURCE_CHAT_ID=-1001234567890
SOURCE_CHANNEL_ID=-1001234567890
TELEGRAM_TARGET_GROUP_ID=-1001234567890
TARGET_GROUP_ID=-1001234567890
```

---

### Highway API (Carrier Health Check)

Required for the carrier health check feature on `/admin/users`:

```bash
HIGHWAY_API_KEY=your_highway_staging_api_key_here
```

**Where to get:**
- Contact Highway support or access your Highway staging account
- The API key should be a JWT token for the staging environment
- Make sure to remove any spaces when pasting the key

---

### Application URLs

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## Your Current Setup

Based on what we've configured, your `.env.local` should have at minimum:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://rbiomzdrlmsexehrhowa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiaW9temRybG1zZXhlaHJob3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDEwNDgsImV4cCI6MjA3MzcxNzA0OH0.0KUvku4GlVru9dmDBbqQjzgIjBhmapi0pHJHhXtG84E
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiaW9temRybG1zZXhlaHJob3dhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODE0MTA0OCwiZXhwIjoyMDczNzE3MDQ4fQ.HUdc3n3rkmN6uh8mmzWmY7Mv5-T3U22vckDN0v12j-E

# Auth Provider
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true

# Database
DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:LVJPHzZbah5pW4Lp@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require

# Optional pool tuning
PG_POOL_MAX=15
PG_IDLE_TIMEOUT=20
PG_CONNECT_TIMEOUT=30
PG_MAX_LIFETIME=1800

# Telegram (if using)
TELEGRAM_BOT_TOKEN=8248740929:AAFCYaxTIxDxPvtGXFcMvmfQYDi6xIZ3cD8
BOT_TOKEN=8248740929:AAFCYaxTIxDxPvtGXFcMvmfQYDi6xIZ3cD8
TELEGRAM_SOURCE_CHAT_ID=-1002560784901
SOURCE_CHANNEL_ID=-1002560784901
TELEGRAM_TARGET_GROUP_ID=-4743051446
TARGET_GROUP_ID=-4743051446

# EAX (if using)
EAX_BASE_URL=https://eax.shiprrexp.com
EAX_USERNAME=disaac
EAX_PASSWORD=Isaac123.

# App URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

---

## Security Notes

⚠️ **IMPORTANT:**
- `.env.local` is in `.gitignore` - **NEVER commit it to git**
- `SUPABASE_SERVICE_ROLE_KEY` is secret - **never expose to browser**
- Use different keys for development and production
- Rotate keys if they're exposed

---

## Verification

After setting up `.env.local`, verify it's working:

1. **Restart your dev server:**
   ```bash
   npm run dev
   ```

2. **Check for errors:**
   - Terminal should not show "missing environment variable" errors
   - Browser console should not show Supabase connection errors

3. **Test auth:**
   - Visit: http://localhost:3000/sign-in
   - Try signing in with Google
   - Should work without errors

---

## Troubleshooting

**Missing variables error:**
- Make sure `.env.local` is in the project root (same level as `package.json`)
- Restart the dev server after changing `.env.local`
- Check for typos in variable names

**Supabase connection errors:**
- Verify keys are correct in Supabase Dashboard
- Make sure you copied the full key (they're long!)
- Check that `NEXT_PUBLIC_SUPABASE_URL` matches your project

**Database connection errors:**
- Verify `DATABASE_URL` is the pooler URL (port 6543)
- Check password is correct
- Ensure database is accessible from your IP



