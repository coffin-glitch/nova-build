/**
 * Email Batch Queue
 * 
 * Collects emails and sends them in batches of up to 100 emails per request.
 * This dramatically improves throughput when many users need notifications.
 * 
 * Example: 500 emails
 * - Without batching: 500 requests = 250 seconds (at 2 req/sec)
 * - With batching: 5 batch requests = 2.5 seconds (at 2 req/sec)
 * 
 * That's a 100x speedup!
 */

import { EmailOptions } from '../email/notify';

export interface BatchedEmail extends EmailOptions {
  id?: string; // Optional ID for tracking
}

class EmailBatchQueue {
  private queue: BatchedEmail[] = [];
  private batchSize: number = 100; // Resend's max batch size
  private flushInterval: number = 2000; // Flush every 2 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private sendCallback: ((emails: BatchedEmail[]) => Promise<void>) | null = null;

  constructor() {
    // Auto-flush on interval to prevent emails from sitting too long
    this.startAutoFlush();
  }

  /**
   * Add an email to the batch queue
   */
  add(email: BatchedEmail): void {
    this.queue.push(email);

    // If queue is full, flush immediately
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Set the callback function that will send batches
   */
  setSendCallback(callback: (emails: BatchedEmail[]) => Promise<void>): void {
    this.sendCallback = callback;
  }

  /**
   * Flush the queue and send all emails in batches
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    // Clear the auto-flush timer temporarily
    this.stopAutoFlush();

    // Process in batches of batchSize
    const batches: BatchedEmail[][] = [];
    for (let i = 0; i < this.queue.length; i += this.batchSize) {
      const batch = this.queue.slice(i, i + this.batchSize);
      if (batch.length > 0) {
        batches.push(batch);
      }
    }

    // Clear the queue
    const queueLength = this.queue.length;
    this.queue = [];

    // Send each batch
    if (this.sendCallback && batches.length > 0) {
      for (const batch of batches) {
        if (batch.length === 0) {
          continue; // Skip empty batches
        }
        
        try {
          await this.sendCallback(batch);
        } catch (error) {
          console.error(`[Email Batch] Error in sendCallback for batch of ${batch.length} emails:`, error);
          // Re-queue failed emails? Or log and continue?
          // For now, we'll log and continue - failed emails can be retried by the job system
        }
      }
    } else if (batches.length === 0 && queueLength > 0) {
      console.warn(`[Email Batch] Queue had ${queueLength} emails but no batches were created`);
    }

    // Restart auto-flush
    this.startAutoFlush();
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Force flush and cleanup (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
  }
}

// Global batch queue instance
export const emailBatchQueue = new EmailBatchQueue();

