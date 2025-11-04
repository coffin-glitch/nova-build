# Phase 7: Cutover & Rollback - Implementation Guide

## Overview

Phase 7 implements feature toggles, monitoring, and rollback capability for safe migration from Clerk to Supabase. This is the final phase that enables controlled cutover and quick rollback if needed.

## ✅ Completed Components

### 1. Auth Configuration (`lib/auth-config.ts`)

**Purpose**: Centralized feature flag and configuration management.

**Features**:
- Provider detection from environment variables
- Configuration validation
- Feature flag support
- Dual-auth mode support

**Environment Variables**:
```bash
# Primary toggle (server-side)
AUTH_PROVIDER=clerk  # or "supabase"

# Client-side toggle
NEXT_PUBLIC_USE_SUPABASE_AUTH=false  # or "true"

# Optional features
ALLOW_DUAL_AUTH=false
ENABLE_AUTH_MONITORING=true
ENABLE_AUTH_ROLLBACK=true
```

### 2. Auth Monitoring (`lib/auth-monitoring.ts`)

**Purpose**: Track auth events and metrics for monitoring migration success.

**Features**:
- Event logging (sign-in, sign-up, sign-out, failures)
- Metrics calculation (failure rates, event counts)
- Rollback recommendations
- Time-based analytics (1h, 24h, 7d)

**Metrics Tracked**:
- Total events
- Sign-ins/sign-ups/sign-outs
- Failure count and rate
- Provider usage (Clerk vs Supabase)
- Rollback recommendations

---

## 🔄 Cutover Process

### Pre-Cutover Checklist

- [ ] All phases 1-6 complete
- [ ] SMTP configured in Supabase Dashboard
- [ ] Backfill script run (if users exist)
- [ ] Testing completed with Supabase auth
- [ ] Monitoring dashboard ready
- [ ] Rollback plan documented
- [ ] Team notified

### Step 1: Enable Monitoring

```bash
# .env.local (or production env)
ENABLE_AUTH_MONITORING=true
ENABLE_AUTH_ROLLBACK=true
```

### Step 2: Test in Staging

```bash
# Staging environment
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true
```

Monitor for:
- Sign-in success rate
- Sign-up success rate
- Error rates
- Performance

### Step 3: Gradual Rollout (Recommended)

**Day 1-2: 10% traffic**
```bash
# Use feature flag in code to route 10% to Supabase
```

**Day 3-4: 50% traffic**
```bash
# Increase to 50%
```

**Day 5-7: 100% traffic**
```bash
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true
```

### Step 4: Full Cutover

```bash
# Production environment
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true
```

### Step 5: Monitor for 7 Days

- Check metrics daily
- Watch for rollback recommendations
- Monitor error logs
- Track user feedback

---

## 🔙 Rollback Process

### Immediate Rollback (< 5 minutes)

If critical issues are detected:

```bash
# Update environment variables
AUTH_PROVIDER=clerk
NEXT_PUBLIC_USE_SUPABASE_AUTH=false

# Redeploy or restart application
```

**Result**: App immediately reverts to Clerk auth. All existing Clerk sessions remain valid.

### Rollback Triggers

Automatic rollback should be considered if:

1. **High Failure Rate**: > 10% auth failures
2. **No Successful Auth**: No sign-ins/sign-ups for extended period
3. **Critical Errors**: Database errors, API failures
4. **User Complaints**: Multiple user reports of auth issues

### Rollback Steps

1. **Detect Issue**: Monitoring alerts or manual detection
2. **Verify Issue**: Check metrics and logs
3. **Decide Rollback**: Use `shouldRollback()` or manual decision
4. **Execute Rollback**: Update env vars and redeploy
5. **Verify Rollback**: Test Clerk auth works
6. **Investigate**: Fix issues in Supabase implementation
7. **Retry**: Attempt cutover again after fixes

---

## 📊 Monitoring Dashboard

### Create Admin Metrics Endpoint

**File**: `app/api/admin/auth-metrics/route.ts`

```typescript
import { requireApiAdmin } from "@/lib/auth-api-helper";
import { getAuthMetricsForAPI } from "@/lib/auth-monitoring";
import { NextResponse } from "next/server";

export async function GET() {
  await requireApiAdmin(); // Require admin access
  
  const metrics = getAuthMetricsForAPI();
  
  return NextResponse.json(metrics);
}
```

### View Metrics

1. Navigate to `/api/admin/auth-metrics` (admin only)
2. Or create admin dashboard page
3. Monitor:
   - Sign-in success rate
   - Failure rate
   - Provider usage
   - Rollback recommendations

---

## 🔍 Key Metrics to Monitor

### Success Metrics

- ✅ **Sign-in Success Rate**: > 95%
- ✅ **Sign-up Success Rate**: > 90%
- ✅ **Session Persistence**: > 98%
- ✅ **Email Delivery**: > 99% (check Supabase Dashboard)

### Failure Metrics

- ❌ **Auth Failure Rate**: < 5%
- ❌ **API Errors**: < 1%
- ❌ **Database Errors**: < 0.1%

### Performance Metrics

- ⚡ **Auth Response Time**: < 500ms
- ⚡ **Page Load Time**: No degradation
- ⚡ **Database Query Time**: No increase

---

## 📝 Environment Variables Reference

### Required for Supabase

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth Provider Toggle
AUTH_PROVIDER=supabase  # or "clerk"
NEXT_PUBLIC_USE_SUPABASE_AUTH=true  # or "false"
```

### Optional Configuration

```bash
# Feature Flags
ALLOW_DUAL_AUTH=false
ENABLE_AUTH_MONITORING=true
ENABLE_AUTH_ROLLBACK=true

# Database (already configured)
DATABASE_URL=postgresql://...  # pgBouncer pooler URL

# Monitoring (optional)
SENTRY_DSN=...  # For error tracking
DATADOG_API_KEY=...  # For metrics
```

---

## ⚠️ Common Issues & Solutions

### Issue: High Failure Rate

**Symptoms**: > 10% auth failures

**Possible Causes**:
- SMTP not configured
- Redirect URLs not whitelisted
- Callback handler not working

**Solutions**:
1. Check Supabase Dashboard → Authentication → Settings
2. Verify redirect URLs are whitelisted
3. Test callback handler: `/auth/callback`
4. Check email delivery in Supabase logs

### Issue: Users Can't Sign In

**Symptoms**: All sign-in attempts fail

**Possible Causes**:
- Session not persisting
- Cookie issues
- Provider mismatch

**Solutions**:
1. Check browser console for errors
2. Verify cookies are being set
3. Check SupabaseProvider is mounted
4. Verify middleware is working

### Issue: Email Not Sending

**Symptoms**: No confirmation emails received

**Possible Causes**:
- SMTP not configured
- Email rate limit exceeded
- Email provider issues

**Solutions**:
1. Check Supabase Dashboard → Authentication → Settings → SMTP
2. Verify email templates are configured
3. Check Supabase logs for email errors
4. Consider upgrading SMTP provider

---

## ✅ Post-Cutover Checklist

After successful cutover (7 days):

- [ ] No rollback needed
- [ ] All metrics within acceptable range
- [ ] User feedback positive
- [ ] No critical bugs reported
- [ ] Performance acceptable
- [ ] Remove Clerk dependencies (optional)
- [ ] Update documentation
- [ ] Archive Clerk credentials (keep as backup for 30 days)

---

## 🔐 Security Considerations

### During Migration

- Keep Clerk credentials active as backup
- Don't delete Clerk data immediately
- Monitor for security issues
- Verify Supabase RLS policies (if implemented)

### After Successful Migration

- Archive Clerk credentials (don't delete immediately)
- Keep Clerk data for 30 days as backup
- Remove Clerk from codebase (optional, after validation)
- Update security documentation

---

## 📈 Success Criteria

Migration is successful when:

1. ✅ Supabase auth working for 7+ days
2. ✅ Failure rate < 5%
3. ✅ No user complaints
4. ✅ All metrics within acceptable range
5. ✅ Rollback not needed
6. ✅ Performance acceptable

---

**Status**: Phase 7 Complete ✅  
**Migration Ready**: All phases complete, ready for cutover  
**Last Updated**: 2025-01-30


