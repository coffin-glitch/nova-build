# Production Database Pool Settings for 5000+ Users

## Recommended Settings

For handling 5000+ concurrent users, update your `.env.local` with these pool settings:

```bash
# Production Pool Settings (5000+ users)
PG_POOL_MAX=100
PG_IDLE_TIMEOUT=30
PG_CONNECT_TIMEOUT=10
PG_MAX_LIFETIME=3600
```

## Why These Settings?

### PG_POOL_MAX=100 (was 15)
- **15 connections**: Too low for 5000+ users - will cause connection timeouts
- **100 connections**: Good balance for 5000-10k users
- **250 connections**: Recommended for 10k+ users (if your database supports it)

**Supabase Connection Limits:**
- Free tier: Up to 200 direct connections
- Pro tier: Up to 400 direct connections
- Using connection pooler (port 6543): Much higher limits

### PG_IDLE_TIMEOUT=30 (was 20)
- **30 seconds**: Good default - closes idle connections quickly
- Prevents connection pool exhaustion
- Your current 20 is fine, but 30 is more standard

### PG_CONNECT_TIMEOUT=10 (was 30)
- **10 seconds**: Faster timeout = better user experience
- **30 seconds**: Too long - users will wait too long on errors
- Recommended: 10 seconds

### PG_MAX_LIFETIME=3600 (was 1800)
- **3600 seconds (1 hour)**: Standard for production
- **1800 seconds (30 min)**: Also fine, but 1 hour is more common
- Recycles connections to prevent stale connections

## Supabase Connection Pooler

If you're using Supabase, make sure you're using the **connection pooler** URL (port 6543):

```bash
# ✅ GOOD - Uses connection pooler (handles 1000s of connections)
DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require

# ❌ BAD - Direct connection (limited to ~200 connections)
DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:password@aws-1-us-east-2.supabase.com:5432/postgres?sslmode=require
```

## Scaling Recommendations

### For 5,000-10,000 users:
```bash
PG_POOL_MAX=100
PG_IDLE_TIMEOUT=30
PG_CONNECT_TIMEOUT=10
PG_MAX_LIFETIME=3600
```

### For 10,000+ users:
```bash
PG_POOL_MAX=250
PG_IDLE_TIMEOUT=30
PG_CONNECT_TIMEOUT=10
PG_MAX_LIFETIME=3600
```

### For 50,000+ users:
- Consider database read replicas
- Use connection pooler (PgBouncer/Supabase pooler)
- Consider upgrading Supabase plan
- Monitor connection usage

## Monitoring

Watch for these signs you need to increase pool size:
- Connection timeout errors
- Slow query responses
- "too many clients" errors
- High connection wait times

## Your Current Settings vs Recommended

| Setting | Current | Recommended | Why |
|---------|---------|-------------|-----|
| PG_POOL_MAX | 15 | 100 | Too low for 5000+ users |
| PG_IDLE_TIMEOUT | 20 | 30 | Both are fine, 30 is standard |
| PG_CONNECT_TIMEOUT | 30 | 10 | 30s is too long for users |
| PG_MAX_LIFETIME | 1800 | 3600 | Both fine, 3600 is standard |

