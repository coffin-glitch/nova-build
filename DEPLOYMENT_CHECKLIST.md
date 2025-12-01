# 🚀 Production Deployment Checklist for novafreight.io

## Pre-Deployment Checklist

### ✅ 1. Code Preparation
- [ ] All changes committed to git
- [ ] All test bids removed from database
- [ ] No console.log statements with sensitive data
- [ ] All environment variables documented

### ✅ 2. Database Setup
- [ ] Production database configured (Supabase)
- [ ] All migrations run on production database
- [ ] Database backups configured
- [ ] Connection pooling enabled

### ✅ 3. Environment Variables

#### Required for Next.js App (Vercel/Railway)
```bash
# Supabase Authentication
NEXT_PUBLIC_SUPABASE_URL=https://rbiomzdrlmsexehrhowa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DATABASE_URL=postgresql://postgres:password@host:5432/postgres?sslmode=require

# Application URLs
NEXT_PUBLIC_APP_URL=https://novafreight.io
NEXT_PUBLIC_BASE_URL=https://novafreight.io

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@novafreight.io
SUPPORT_EMAIL=support@novafreight.io

# Redis (for notifications)
REDIS_URL=your_redis_url

# Webhook Configuration
WEBHOOK_URL=https://novafreight.io/api/webhooks/new-bid
WEBHOOK_API_KEY=your_secure_webhook_key

# Node Environment
NODE_ENV=production
```

#### Required for Notification Worker (Railway)
```bash
# All the above variables PLUS:
REDIS_URL=your_redis_url
NODE_ENV=production
```

### ✅ 4. Domain Configuration

#### Option A: Vercel (Recommended for Next.js)
1. **Add Domain to Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Domains
   - Add `novafreight.io` and `www.novafreight.io`
   - Follow DNS configuration instructions

2. **DNS Configuration:**
   ```
   Type: A
   Name: @
   Value: 76.76.21.21 (Vercel's IP - check Vercel dashboard for current IP)
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

#### Option B: Railway (If using Railway for main app)
1. **Add Custom Domain:**
   - Railway Dashboard → Your Project → Settings → Domains
   - Add `novafreight.io`
   - Configure DNS as shown in Railway dashboard

### ✅ 5. SSL Certificate
- [ ] SSL certificate automatically configured (Vercel/Railway handle this)
- [ ] HTTPS redirect enabled
- [ ] Test SSL: `https://novafreight.io`

### ✅ 6. Email Configuration
- [ ] Resend account configured
- [ ] Domain verified in Resend (novafreight.io)
- [ ] SPF/DKIM records added to DNS
- [ ] Test email sending

### ✅ 7. Redis Setup
- [ ] Production Redis instance created (Upstash/Redis Cloud)
- [ ] Redis URL added to environment variables
- [ ] Connection tested

### ✅ 8. Notification Worker
- [ ] Railway worker service deployed
- [ ] Worker environment variables set
- [ ] Worker health check passing
- [ ] Test notification sent

## Deployment Steps

### Step 1: Deploy Notification Worker to Railway

```bash
# 1. Login to Railway
npx @railway/cli login

# 2. Navigate to your Railway project
cd /Users/coffin/nova-build

# 3. Deploy worker (if using Railway CLI)
# Or use Railway dashboard to deploy from GitHub
```

**In Railway Dashboard:**
1. Go to your project
2. Add new service → "Empty Service"
3. Connect GitHub repo
4. Set root directory (if needed)
5. Set start command: `npm run worker:notifications`
6. Add all environment variables
7. Deploy

### Step 2: Deploy Next.js App

#### Option A: Vercel (Recommended)

```bash
# 1. Install Vercel CLI (if not installed)
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Link project
vercel link

# 4. Deploy to production
vercel --prod
```

**Or use Vercel Dashboard:**
1. Go to https://vercel.com
2. Import GitHub repository
3. Configure:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Add all environment variables
5. Add custom domain: `novafreight.io`
6. Deploy

#### Option B: Railway

1. Railway Dashboard → New Service
2. Connect GitHub repo
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add environment variables
6. Add custom domain
7. Deploy

### Step 3: Configure Domain DNS

**For Vercel:**
1. Get DNS records from Vercel dashboard
2. Add to your domain registrar (Namecheap, GoDaddy, etc.)
3. Wait for DNS propagation (5-60 minutes)

**For Railway:**
1. Get DNS records from Railway dashboard
2. Add to your domain registrar
3. Wait for DNS propagation

### Step 4: Update Environment Variables

**Update these URLs in production:**
```bash
NEXT_PUBLIC_APP_URL=https://novafreight.io
NEXT_PUBLIC_BASE_URL=https://novafreight.io
WEBHOOK_URL=https://novafreight.io/api/webhooks/new-bid
```

### Step 5: Test Production Deployment

- [ ] Visit https://novafreight.io
- [ ] Test user registration/login
- [ ] Test bid board loading
- [ ] Test notification system
- [ ] Test admin dashboard
- [ ] Test carrier profile
- [ ] Test email sending
- [ ] Check SSL certificate
- [ ] Test mobile responsiveness

### Step 6: Post-Deployment

- [ ] Monitor error logs
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure analytics (if needed)
- [ ] Set up monitoring/uptime checks
- [ ] Test all critical user flows
- [ ] Verify email delivery
- [ ] Check notification worker logs

## Security Checklist

- [ ] All API keys are in environment variables (not in code)
- [ ] WEBHOOK_API_KEY is strong and unique
- [ ] Database connection uses SSL
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Admin routes protected
- [ ] User authentication working

## Monitoring Setup

- [ ] Error logging configured
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring (UptimeRobot, etc.)
- [ ] Database query monitoring
- [ ] Email delivery monitoring
- [ ] Notification worker health checks

## Rollback Plan

If something goes wrong:
1. Revert to previous deployment in Vercel/Railway
2. Or rollback database migration if needed
3. Check logs for errors
4. Fix issues and redeploy

## Support

- Support Email: support@novafreight.io
- Phone: 832-529-5871

---

**Ready to deploy?** Follow the steps above in order. If you encounter any issues, check the logs and refer to the troubleshooting section in your deployment platform's documentation.

