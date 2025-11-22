# Database Connection Pool & Rate Limiting Analysis
## For 10,000 Concurrent Users

**Date:** 2025-01-16  
**Purpose:** Optimize database connection pool and API rate limiting for 10k concurrent users

---

## 📊 Database Connection Pool Analysis

### Current Configuration
**File:** `lib/db.ts`
```typescript
max: Number(process.env.PG_POOL_MAX || 50), // Current default: 50
idle_timeout: Number(process.env.PG_IDLE_TIMEOUT || 20),
connect_timeout: Number(process.env.PG_CONNECT_TIMEOUT || 30),
max_lifetime: Number(process.env.PG_MAX_LIFETIME || 60 * 30),
```

### Recommended Settings for 10,000 Users

#### Calculation Methodology
1. **Peak Concurrent Users:** Assume 20-30% of total users active at peak = 2,000-3,000 concurrent
2. **Average Request Duration:** 50-200ms per database query
3. **Connection Reuse:** With proper pooling, each connection can handle 10-50 requests/second
4. **Safety Buffer:** Add 15-20% buffer for traffic spikes

#### Recommended Pool Size
```bash
# For 10,000 users with 2,000-3,000 concurrent at peak:
PG_POOL_MAX=200-300

# Conservative (safe) setting:
PG_POOL_MAX=250

# Aggressive (performance) setting:
PG_POOL_MAX=400
```

#### Complete Recommended Configuration
```bash
# .env.local - Database Connection Pool Settings
PG_POOL_MAX=250                    # Max connections (was 50)
PG_IDLE_TIMEOUT=30                 # Keep idle connections 30s (was 20s)
PG_CONNECT_TIMEOUT=10              # Faster connection timeout (was 30s)
PG_MAX_LIFETIME=3600               # 1 hour max connection lifetime (was 30min)
```

### Supabase Considerations
- **Supabase Transaction Pooler:** Uses port 6543 (already configured)
- **Supabase Connection Limits:**
  - Free tier: ~60 connections
  - Pro tier: ~200 connections
  - Team tier: ~400 connections
  - Enterprise: Custom limits

**⚠️ IMPORTANT:** If using Supabase, ensure your plan supports the pool size you configure!

### PostgreSQL Server Limits
- **Default max_connections:** Usually 100-200
- **Recommended:** Set `max_connections` on PostgreSQL server to at least 1.5x your pool size
- **For 250 pool size:** PostgreSQL should allow 375+ connections

---

## 🚦 Rate Limiting Analysis

### Current State
- Rate limiting exists in `lib/advanced-security.ts` but not widely implemented
- Notification rate limiting in `lib/notification-cache.ts` with tiered system

### Recommended Generous Rate Limits

#### Public Routes (Unauthenticated)
```typescript
{
  maxRequests: 100,        // 100 requests per window
  windowMs: 60000,         // 1 minute window
  // = 100 req/min = ~1.67 req/sec (very generous)
}
```

#### Authenticated Carrier Routes
```typescript
{
  maxRequests: 200,         // 200 requests per window
  windowMs: 60000,         // 1 minute window
  // = 200 req/min = ~3.33 req/sec (generous for normal usage)
}
```

#### Admin Routes
```typescript
{
  maxRequests: 500,        // 500 requests per window
  windowMs: 60000,         // 1 minute window
  // = 500 req/min = ~8.33 req/sec (generous for admin operations)
}
```

#### Critical Operations (Bid Submission, Load Updates)
```typescript
{
  maxRequests: 50,         // 50 requests per window
  windowMs: 60000,         // 1 minute window
  // = 50 req/min (prevents abuse while allowing legitimate bursts)
}
```

### Rate Limiting Strategy

#### Tiered Rate Limiting
1. **IP-Based (First Layer):**
   - Prevents DDoS and abuse
   - More restrictive limits
   - Blocks suspicious IPs

2. **User-Based (Second Layer):**
   - Per authenticated user
   - More generous limits
   - Tracks per user ID

3. **Endpoint-Based (Third Layer):**
   - Different limits per endpoint type
   - Critical operations get lower limits
   - Read operations get higher limits

#### Recommended Implementation
```typescript
// lib/rate-limiting.ts
export const RATE_LIMITS = {
  // Public routes
  public: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
  
  // Authenticated routes
  authenticated: {
    maxRequests: 200,
    windowMs: 60000, // 1 minute
  },
  
  // Admin routes
  admin: {
    maxRequests: 500,
    windowMs: 60000, // 1 minute
  },
  
  // Critical operations (bid submission, etc.)
  critical: {
    maxRequests: 50,
    windowMs: 60000, // 1 minute
  },
  
  // File uploads
  fileUpload: {
    maxRequests: 20,
    windowMs: 60000, // 1 minute
  },
};
```

---

## 📋 Action Items

### 1. Database Connection Pool (URGENT)
**File to Update:** `.env.local`

```bash
# Add/Update these values:
PG_POOL_MAX=250
PG_IDLE_TIMEOUT=30
PG_CONNECT_TIMEOUT=10
PG_MAX_LIFETIME=3600
```

**⚠️ REMINDER:** 
- Check your Supabase plan limits before increasing
- If using self-hosted PostgreSQL, increase `max_connections` in `postgresql.conf`
- Monitor connection usage after deployment

### 2. Rate Limiting Implementation
**Files to Create/Update:**
- Create `lib/rate-limiting.ts` with generous limits
- Update `lib/advanced-security.ts` to use new limits
- Apply rate limiting to all API routes

### 3. Monitoring
- Set up alerts for connection pool exhaustion
- Monitor rate limit violations
- Track connection wait times
- Alert on >80% pool utilization

---

## 🔍 Monitoring & Alerts

### Key Metrics to Monitor

1. **Database Connection Pool:**
   - Active connections
   - Idle connections
   - Connection wait time
   - Pool utilization percentage

2. **Rate Limiting:**
   - Requests per minute per user
   - Rate limit violations
   - Blocked IPs
   - Endpoint-specific limits

3. **Performance:**
   - Average query time
   - Slow queries (>1s)
   - Connection errors
   - Timeout errors

---

## 📈 Scaling Considerations

### When to Increase Pool Size
- Connection wait times > 100ms
- Pool utilization consistently > 80%
- Database connection errors increasing
- User complaints about slow responses

### When to Adjust Rate Limits
- Legitimate users hitting limits
- High rate limit violation rates
- User complaints about throttling
- Business needs require higher limits

---

## ✅ Summary

### Database Connection Pool
- **Current:** 50 connections
- **Recommended:** 250 connections (5x increase)
- **For 10k users:** 250-400 connections depending on traffic patterns

### Rate Limiting
- **Public:** 100 req/min (very generous)
- **Authenticated:** 200 req/min (generous)
- **Admin:** 500 req/min (very generous)
- **Critical:** 50 req/min (prevents abuse)

### Next Steps
1. ✅ Update `.env.local` with new pool settings
2. ✅ Implement rate limiting middleware
3. ✅ Add monitoring and alerts
4. ✅ Test under load
5. ✅ Adjust based on real-world usage

---

**⚠️ CRITICAL REMINDER:** 
Before deploying, verify your database provider (Supabase/self-hosted) supports the connection pool size you configure!

