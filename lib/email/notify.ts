/**
 * Email Notification System
 * Provider-agnostic email sending with feature flag support
 * 
 * Supports Resend (recommended) with React Email templates
 */

import * as React from 'react';
import { Resend } from 'resend';

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
 */
class ResendEmailProvider implements EmailProvider {
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn('[Email - Resend] RESEND_API_KEY not set, emails will not be sent');
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.resend) {
      console.warn('[Email - Resend] Resend client not initialized');
      return {
        success: false,
        error: 'Resend API key not configured',
      };
    }

    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'NOVA Build <onboarding@resend.dev>';
      
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
        error: error?.message || 'Unknown error sending email',
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
  } catch (error: any) {
    console.error('[Email] Error sending email:', error);
    return {
      success: false,
      error: error?.message || 'Unknown email error',
    };
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

