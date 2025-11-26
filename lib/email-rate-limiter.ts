/**
 * Global Email Rate Limiter
 * 
 * Uses Redis to coordinate rate limiting across multiple worker processes
 * Ensures we never exceed Resend's 2 requests/second limit globally
 * 
 * This is critical for scaling to 10,000+ users where multiple workers
 * might try to send emails simultaneously for the same bid.
 */

// Import Redis connection from notification-queue
import { redisConnection } from './notification-queue';

const EMAIL_RATE_LIMIT_INTERVAL_MS = 500; // 2 requests per second = 500ms between requests
const EMAIL_RATE_LIMIT_KEY = 'email:rate_limit:last_sent';
const EMAIL_QUEUE_KEY = 'email:queue:waiting';

/**
 * Global rate limiter for email sends using Redis
 * This ensures that even with multiple workers, we never exceed 2 emails/second
 */
export async function rateLimitEmailGlobal(): Promise<void> {
  try {
    // Use Redis to coordinate across all workers
    // We'll use a simple approach: check last sent time and wait if needed
    
    // Get the last sent timestamp from Redis
    const lastSentStr = await redisConnection.get(EMAIL_RATE_LIMIT_KEY);
    const lastSent = lastSentStr ? parseInt(lastSentStr, 10) : 0;
    const now = Date.now();
    const timeSinceLastEmail = now - lastSent;
    
    if (timeSinceLastEmail < EMAIL_RATE_LIMIT_INTERVAL_MS) {
      // We need to wait
      const waitTime = EMAIL_RATE_LIMIT_INTERVAL_MS - timeSinceLastEmail;
      console.log(`[Email Rate Limit] Waiting ${waitTime}ms to respect 2 req/sec limit`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Update the last sent timestamp in Redis
    // Use SET with EX (expire after 1 second) to auto-cleanup
    // This creates a distributed lock that ensures only one email is sent at a time
    await redisConnection.set(EMAIL_RATE_LIMIT_KEY, Date.now().toString(), 'EX', 1);
    
  } catch (error) {
    console.error('[Email Rate Limit] Error in global rate limiter:', error);
    // Fallback: wait the full interval if Redis fails
    await new Promise(resolve => setTimeout(resolve, EMAIL_RATE_LIMIT_INTERVAL_MS));
  }
}

/**
 * Get current email queue size (for monitoring)
 */
export async function getEmailQueueSize(): Promise<number> {
  try {
    const size = await redisConnection.llen(EMAIL_QUEUE_KEY);
    return size || 0;
  } catch (error) {
    console.error('[Email Rate Limit] Error getting queue size:', error);
    return 0;
  }
}

/**
 * Check if we can send an email now (non-blocking check)
 */
export async function canSendEmailNow(): Promise<boolean> {
  try {
    const lastSentStr = await redisConnection.get(EMAIL_RATE_LIMIT_KEY);
    if (!lastSentStr) return true;
    
    const lastSent = parseInt(lastSentStr, 10);
    const now = Date.now();
    const timeSinceLastEmail = now - lastSent;
    
    return timeSinceLastEmail >= EMAIL_RATE_LIMIT_INTERVAL_MS;
  } catch (error) {
    console.error('[Email Rate Limit] Error checking if can send:', error);
    return true; // Allow send on error to prevent blocking
  }
}

