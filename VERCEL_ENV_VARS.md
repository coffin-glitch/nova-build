# Vercel Environment Variables for novafreight.io

## Required Environment Variables

Copy these to Vercel Dashboard → Your Project → Settings → Environment Variables

### Production Environment Variables

```bash
# Supabase Authentication
NEXT_PUBLIC_SUPABASE_URL=https://rbiomzdrlmsexehrhowa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database
DATABASE_URL=your_production_database_url_here

# Application URLs (IMPORTANT - Update for production)
NEXT_PUBLIC_APP_URL=https://novafreight.io
NEXT_PUBLIC_BASE_URL=https://novafreight.io

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@novafreight.io
SUPPORT_EMAIL=support@novafreight.io

# Redis (for notifications)
REDIS_URL=your_redis_url_here

# Webhook Configuration
WEBHOOK_URL=https://novafreight.io/api/webhooks/new-bid
WEBHOOK_API_KEY=generate_a_secure_random_key_here

# Node Environment
NODE_ENV=production

# Auth Provider
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true

# Optional: Telegram (if using)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_SOURCE_CHAT_ID=your_source_chat_id
TELEGRAM_TARGET_GROUP_ID=your_target_group_id

# Optional: EAX (if using)
EAX_BASE_URL=https://eax.shiprrexp.com
EAX_USERNAME=your_username
EAX_PASSWORD=your_password

# Optional: Highway API (if using)
HIGHWAY_API_KEY=your_highway_api_key
```

## How to Add in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project (or create new one)
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add each variable:
   - **Key**: Variable name (e.g., `NEXT_PUBLIC_APP_URL`)
   - **Value**: Variable value (e.g., `https://novafreight.io`)
   - **Environment**: Select **Production** (and optionally Preview/Development)
6. Click **Save**
7. Repeat for all variables above

## Important Notes

⚠️ **Before deploying:**
- Make sure `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_BASE_URL` are set to `https://novafreight.io`
- Generate a secure `WEBHOOK_API_KEY` (use a random string generator)
- Update `RESEND_FROM_EMAIL` to use your domain (may need domain verification in Resend)
- Make sure `DATABASE_URL` points to your production database

⚠️ **After deploying:**
- You'll need to add the custom domain `novafreight.io` in Vercel
- Configure DNS records at your domain registrar
- Wait for DNS propagation (5-60 minutes)

