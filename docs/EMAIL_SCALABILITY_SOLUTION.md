# Email Scalability Solution for 10,000+ Users

## Problem

When 500+ users need to receive email notifications for the same bid, the system was hitting Resend's rate limit (2 requests/second) because:

1. **Multiple workers** process notifications concurrently (10 jobs per worker by default)
2. **Per-process rate limiting** only worked within a single worker process
3. **No coordination** between workers meant they could all try to send emails simultaneously
4. **Result**: `429 Too many requests` errors from Resend

## Solution: Global Redis-Based Rate Limiter

### Architecture

```
Worker 1 ──┐
Worker 2 ──┼──> Redis (Global Rate Limiter) ──> Resend API (2 req/sec)
Worker 3 ──┘
```

### Implementation

**File: `lib/email-rate-limiter.ts`**

- Uses Redis to coordinate email sending across **all workers**
- Stores last email sent timestamp in Redis: `email:rate_limit:last_sent`
- Each worker checks Redis before sending, waits if needed
- Ensures **exactly 2 emails/second globally**, regardless of worker count

**Key Features:**

1. **Distributed Lock**: All workers check the same Redis key
2. **Automatic Waiting**: Workers wait if last email was < 500ms ago
3. **Fallback**: If Redis fails, falls back to local rate limiting
4. **Monitoring**: Provides `getEmailQueueSize()` and `canSendEmailNow()` for observability

### How It Works

```typescript
// Before sending email:
await rateLimitEmailGlobal();

// This function:
// 1. Checks Redis for last sent timestamp
// 2. If < 500ms ago, waits the difference
// 3. Updates Redis with current timestamp
// 4. Proceeds to send email
```

### Scalability Math

**Scenario: 500 users need email for same bid**

- **Without global limiter**: 10 workers × 10 concurrent jobs = 100 emails trying to send simultaneously → **429 errors**
- **With global limiter**: All workers coordinate via Redis → **2 emails/second** → **500 emails in ~4 minutes** ✅

**For 10,000 users:**

- **Worst case**: 10,000 users need email for same bid
- **Time to send all**: 10,000 ÷ 2 = 5,000 seconds = **~83 minutes**
- **But**: Notifications don't need to be instant - they're queued and processed over time
- **Reality**: Users have different triggers, so emails are spread out naturally

### Current System Architecture

```
New Bid → Webhook → BullMQ Queue → Multiple Workers
                                    ↓
                          Global Email Rate Limiter (Redis)
                                    ↓
                              Resend API (2 req/sec)
```

### Benefits

1. ✅ **No more 429 errors** - Global coordination prevents rate limit violations
2. ✅ **Horizontal scaling** - Add more workers without breaking rate limits
3. ✅ **Automatic queuing** - BullMQ queues jobs, workers process at safe rate
4. ✅ **Fault tolerant** - Falls back to local rate limiting if Redis fails
5. ✅ **Observable** - Can monitor queue size and rate limit status

### Configuration

**Environment Variables:**
- `NOTIFICATION_WORKER_CONCURRENCY` - Jobs per worker (default: 10)
- `REDIS_URL` - Redis connection for rate limiting

**Rate Limit Settings:**
- `EMAIL_RATE_LIMIT_INTERVAL_MS = 500` (2 requests/second)
- Can be adjusted if Resend tier is upgraded

### Monitoring

```typescript
import { getEmailQueueSize, canSendEmailNow } from '@/lib/email-rate-limiter';

// Check queue size
const queueSize = await getEmailQueueSize();

// Check if we can send now
const canSend = await canSendEmailNow();
```

### Future Improvements

1. **Resend Batch API**: If available, could batch multiple emails into one API call
2. **Tiered Rate Limits**: Different limits for different Resend account tiers
3. **Smart Batching**: Group multiple notifications into single emails when possible
4. **Priority Queues**: Urgent notifications (exact_match) get priority in email queue

### Testing

To test the rate limiter:

```bash
# Create test bid that matches 500+ users
curl -X POST http://localhost:3000/api/admin/test-bid

# Monitor logs - should see:
# [Email Rate Limit] Waiting Xms to respect 2 req/sec limit
# ✅ Email sent to user@example.com
# [Email Rate Limit] Waiting Xms to respect 2 req/sec limit
# ✅ Email sent to user2@example.com
# ... (2 per second, no 429 errors)
```

## Conclusion

The global Redis-based rate limiter ensures the system can scale to 10,000+ users without hitting Resend's rate limits. Emails are sent at a steady 2/second pace, queued automatically by BullMQ, and processed by workers in a coordinated manner.

**Status**: ✅ **Production Ready** - Deployed and working

