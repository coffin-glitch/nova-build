/**
 * Email Notification System
 * Provider-agnostic email sending with feature flag support
 * 
 * Supports Resend (recommended) with React Email templates
 */

import * as React from 'react';
import { Resend } from 'resend';

// Import global rate limiter for multi-worker coordination
import { rateLimitEmailGlobal } from '../email-rate-limiter';

// Fallback local rate limiting (for when Redis is unavailable)
let lastEmailSentAt = 0;
const MIN_EMAIL_INTERVAL_MS = 500; // 500ms = 2 requests per second max

async function rateLimitEmail(): Promise<void> {
  // Use global Redis-based rate limiter for multi-worker coordination
  // This ensures we never exceed 2 emails/second even with multiple workers
  try {
    await rateLimitEmailGlobal();
  } catch (error) {
    // Fallback to local rate limiting if Redis fails
    console.warn('[Email] Global rate limiter failed, using local fallback:', error);
    const now = Date.now();
    const timeSinceLastEmail = now - lastEmailSentAt;
    
    if (timeSinceLastEmail < MIN_EMAIL_INTERVAL_MS) {
      const waitTime = MIN_EMAIL_INTERVAL_MS - timeSinceLastEmail;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastEmailSentAt = Date.now();
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactElement; // For React Email templates
}

interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * No-op email provider for development/testing
 */
class NoOpEmailProvider implements EmailProvider {
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('[Email - NoOp] Would send email:', {
      to: options.to,
      subject: options.subject,
    });
    
    // Return success for development - prevents blocking notifications
    return {
      success: true,
      messageId: `noop-${Date.now()}`,
    };
  }
}

/**
 * Resend Email Provider
 * Uses Resend API with React Email templates (2024-2025 best practice)
 * Supports batch sending for improved throughput (up to 100 emails per request)
 */
class ResendEmailProvider implements EmailProvider {
  private resend: Resend | null = null;
  private batchEnabled: boolean;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn('[Email - Resend] RESEND_API_KEY not set, emails will not be sent');
    }
    
    // Enable batch sending by default (can be disabled via env var)
    this.batchEnabled = process.env.ENABLE_EMAIL_BATCHING !== 'false';
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.resend) {
      console.warn('[Email - Resend] Resend client not initialized');
      return {
        success: false,
        error: 'Resend API key not configured',
      };
    }

    // If batch sending is enabled, add to batch queue instead of sending immediately
    if (this.batchEnabled) {
      const { emailBatchQueue } = await import('./batch-queue');
      emailBatchQueue.add(options);
      
      // Return success immediately (actual sending happens in batch)
      return {
        success: true,
        messageId: `batched-${Date.now()}`,
      };
    }

    // Rate limit to respect Resend's 2 requests/second limit (for non-batched sends)
    await rateLimitEmail();

    try {
      // Validate and format from email
      let fromEmail = process.env.RESEND_FROM_EMAIL || 'NOVA Build <onboarding@resend.dev>';
      
      // Clean up the email string (remove quotes, trim whitespace)
      fromEmail = fromEmail.trim().replace(/^["']|["']$/g, '');
      
      // Ensure proper format: "Name <email@domain.com>" or "email@domain.com"
      if (fromEmail.includes('<') && fromEmail.includes('>')) {
        // Already in "Name <email>" format, validate it
        const match = fromEmail.match(/^(.+?)\s*<(.+?)>$/);
        if (match && match[2].includes('@')) {
          // Valid format, use as-is
          fromEmail = `${match[1].trim()} <${match[2].trim()}>`;
        } else {
          // Invalid format, use default
          console.warn(`[Email] Invalid RESEND_FROM_EMAIL format: ${fromEmail}, using default`);
          fromEmail = 'NOVA Build <onboarding@resend.dev>';
        }
      } else if (fromEmail.includes('@')) {
        // Just an email address, wrap it properly
        fromEmail = `NOVA Build <${fromEmail}>`;
      } else {
        // Invalid, use default
        console.warn(`[Email] Invalid RESEND_FROM_EMAIL: ${fromEmail}, using default`);
        fromEmail = 'NOVA Build <onboarding@resend.dev>';
      }
      
      // Final validation: ensure it matches Resend's required format
      if (!/^.+?\s*<.+@.+\..+>$/.test(fromEmail) && !/^.+@.+\..+$/.test(fromEmail)) {
        console.warn(`[Email] RESEND_FROM_EMAIL validation failed: ${fromEmail}, using default`);
        fromEmail = 'NOVA Build <onboarding@resend.dev>';
      }
      
      // Use React Email template if provided (best practice for 2024-2025)
      if (options.react) {
        const { data, error } = await this.resend.emails.send({
          from: fromEmail,
          to: options.to,
          subject: options.subject,
          react: options.react,
        });

        if (error) {
          console.error('[Email - Resend] Error:', error);
          return {
            success: false,
            error: error.message || 'Failed to send email',
          };
        }

        return {
          success: true,
          messageId: data?.id,
        };
      }

              // Fallback to HTML/text if no React template
              const emailPayload: any = {
                from: fromEmail,
                to: options.to,
                subject: options.subject,
              };
              
              if (options.html) {
                emailPayload.html = options.html;
              }
              
              if (options.text) {
                emailPayload.text = options.text;
              }
              
              // Ensure at least html or text is provided
              if (!emailPayload.html && !emailPayload.text) {
                return {
                  success: false,
                  error: 'Either html, text, or react must be provided',
                };
              }
              
              const { data, error } = await this.resend.emails.send(emailPayload);

      if (error) {
        console.error('[Email - Resend] Error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send email',
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error: unknown) {
      console.error('[Email - Resend] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error sending email',
      };
    }
  }
}

/**
 * Google Enterprise Email Provider (placeholder - implement when account is ready)
 */
class GoogleEnterpriseEmailProvider implements EmailProvider {
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.warn('[Email - Google Enterprise] Not yet implemented - using NoOp fallback');
    return new NoOpEmailProvider().sendEmail(options);
  }
}

/**
 * Send a batch of emails using Resend's batch API
 * This is much more efficient than sending individual emails
 */
export async function sendEmailBatch(emails: EmailOptions[]): Promise<{ success: boolean; sent: number; failed: number; errors?: any[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email - Resend] RESEND_API_KEY not set, cannot send batch');
    return { success: false, sent: 0, failed: emails.length };
  }

  const resend = new Resend(apiKey);

  // Rate limit to respect Resend's 2 requests/second limit
  await rateLimitEmail();

  try {
    // Validate and format from email
    let fromEmail = process.env.RESEND_FROM_EMAIL || 'NOVA Build <onboarding@resend.dev>';
    fromEmail = fromEmail.trim().replace(/^["']|["']$/g, '');
    
    if (fromEmail.includes('<') && fromEmail.includes('>')) {
      const match = fromEmail.match(/^(.+?)\s*<(.+?)>$/);
      if (match && match[2].includes('@')) {
        fromEmail = `${match[1].trim()} <${match[2].trim()}>`;
      } else {
        fromEmail = 'NOVA Build <onboarding@resend.dev>';
      }
    } else if (fromEmail.includes('@')) {
      fromEmail = `NOVA Build <${fromEmail}>`;
    } else {
      fromEmail = 'NOVA Build <onboarding@resend.dev>';
    }

    // Prepare batch payload
    const batchPayload = emails.map(email => {
      const payload: any = {
        from: fromEmail,
        to: email.to,
        subject: email.subject,
      };

      if (email.react) {
        payload.react = email.react;
      } else if (email.html) {
        payload.html = email.html;
      } else if (email.text) {
        payload.text = email.text;
      }

      return payload;
    });

    // Send batch (up to 100 emails per request)
    const { data, error } = await resend.batch.send(batchPayload);

    if (error) {
      console.error('[Email - Resend Batch] API Error:', error);
      return {
        success: false,
        sent: 0,
        failed: emails.length,
        errors: [error],
      };
    }

    // Count successful sends
    // Resend batch API returns an array of results, one per email
    const sent = data?.length || 0;
    const failed = emails.length - sent;

    // Check if any emails in the batch failed
    const failedEmails = data?.filter((result: any) => result.error) || [];
    
    if (sent > 0) {
      console.log(`[Email - Resend Batch] Sent ${sent} emails in batch${failed > 0 ? ` (${failed} failed)` : ''}`);
    } else {
      console.error(`[Email - Resend Batch] No emails were sent from batch of ${emails.length}`);
    }

    // If there are failed emails, log them
    if (failedEmails.length > 0) {
      console.warn(`[Email - Resend Batch] ${failedEmails.length} email(s) failed in batch:`, 
        failedEmails.map((f: any) => f.error).slice(0, 3) // Log first 3 errors
      );
    }

    return {
      success: sent > 0,
      sent,
      failed,
      errors: failedEmails.length > 0 ? failedEmails.map((f: any) => f.error) : undefined,
    };
  } catch (error: any) {
    console.error('[Email - Resend Batch] Exception:', error);
    return {
      success: false,
      sent: 0,
      failed: emails.length,
      errors: [error.message || 'Unknown error'],
    };
  }
}

/**
 * Get the configured email provider based on environment variable
 */
function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'none';
  
  switch (provider.toLowerCase()) {
    case 'resend':
      return new ResendEmailProvider();
    case 'google':
    case 'google-enterprise':
    case 'google-workspace':
      return new GoogleEnterpriseEmailProvider();
    case 'sendgrid':
      return new NoOpEmailProvider(); // TODO: Implement SendGrid
    case 'none':
    default:
      return new NoOpEmailProvider();
  }
}

/**
 * Send an email notification
 * Respects EMAIL_PROVIDER environment variable and feature flags
 * 
 * If batch sending is enabled, emails are queued and sent in batches of up to 100.
 * This dramatically improves throughput for high-volume notifications.
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Check if email notifications are globally enabled
    const emailEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';
    if (!emailEnabled) {
      console.log('[Email] Email notifications are disabled via ENABLE_EMAIL_NOTIFICATIONS');
      return { success: true, messageId: 'disabled' };
    }

    const provider = getEmailProvider();
    return await provider.sendEmail(options);
  } catch (error: unknown) {
    console.error('[Email] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

/**
 * Initialize the email batch queue with the send callback
 * Call this once at application startup (e.g., in notification worker)
 */
export async function initializeEmailBatching(): Promise<void> {
  const batchEnabled = process.env.ENABLE_EMAIL_BATCHING !== 'false';
  if (!batchEnabled) {
    console.log('[Email] Batch sending is disabled (set ENABLE_EMAIL_BATCHING=false to disable)');
    return;
  }

  try {
    const { emailBatchQueue } = await import('./batch-queue');
    emailBatchQueue.setSendCallback(async (emails) => {
      // Don't try to send empty batches
      if (!emails || emails.length === 0) {
        console.log('[Email Batch] Skipping empty batch');
        return;
      }

      // sendEmailBatch is defined in this file, so we can call it directly
      const result = await sendEmailBatch(emails);
      
      if (!result.success) {
        // Log detailed error information
        if (result.errors && result.errors.length > 0) {
          console.error(`[Email Batch] Failed to send batch of ${emails.length} emails:`, result.errors);
        } else {
          console.error(`[Email Batch] Failed to send batch of ${emails.length} emails (no error details available)`);
        }
      } else {
        if (result.sent > 0) {
          console.log(`[Email Batch] ✅ Successfully sent ${result.sent} emails in batch${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
        } else {
          console.warn(`[Email Batch] ⚠️ Batch processed but no emails were sent (${result.failed} failed)`);
        }
      }
    });

    console.log('[Email] ✅ Batch sending initialized - emails will be batched (up to 100 per request)');
  } catch (error) {
    console.error('[Email] Failed to initialize batch queue:', error);
    // Don't throw - allow system to continue without batching
  }
}

/**
 * Send notification email for similar load match
 */
export async function sendSimilarLoadNotificationEmail(
  carrierEmail: string,
  bidNumber: string,
  matchScore: number,
  reasons: string[],
  bidUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `🚚 New Load Match Found: ${bidNumber} (${matchScore}% match)`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚚 New Load Match Found!</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1f2937;">Bid Number: ${bidNumber}</h2>
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; border-radius: 4px;">
              <strong style="color: #065f46;">Match Score: ${matchScore}%</strong>
            </div>
            
            <div style="margin: 20px 0;">
              <h3 style="color: #374151; font-size: 16px; margin-bottom: 10px;">Why this matches:</h3>
              <ul style="color: #6b7280; padding-left: 20px;">
                ${reasons.slice(0, 3).map(reason => `<li>${reason}</li>`).join('')}
              </ul>
            </div>
            
            ${bidUrl ? `
              <div style="margin-top: 25px; text-align: center;">
                <a href="${bidUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  View Load Details →
                </a>
              </div>
            ` : ''}
          </div>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0 0 0;">
            You're receiving this because you have similar load notifications enabled in your NOVA Build preferences.
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
New Load Match Found: ${bidNumber}

Match Score: ${matchScore}%

Why this matches:
${reasons.slice(0, 3).map(r => `- ${r}`).join('\n')}

${bidUrl ? `View load: ${bidUrl}` : ''}

You're receiving this because you have similar load notifications enabled.
  `.trim();

  const result = await sendEmail({
    to: carrierEmail,
    subject,
    html,
    text,
  });

  return {
    success: result.success,
    error: result.error,
  };
}

