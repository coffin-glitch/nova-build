import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import sql from "@/lib/db";
import { sendEmail } from "@/lib/email/notify";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/contact
 * Handle contact form submissions
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit for public write operation (contact form)
    const rateLimit = await checkApiRateLimit(request, {
      routeType: 'public'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const body = await request.json();
    const { name, email, subject, message } = body;

    // Input validation
    const validation = validateInput(
      { name, email, subject, message },
      {
        name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 255 },
        subject: { type: 'string', maxLength: 200, required: false },
        message: { required: true, type: 'string', minLength: 10, maxLength: 5000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_contact_form_input', undefined, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate required fields
    if (!name || !email || !message) {
      const response = NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response = NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Save to database first
    const [savedMessage] = await sql`
      INSERT INTO contact_messages (name, email, subject, message, status)
      VALUES (${name}, ${email}, ${subject || null}, ${message}, 'new')
      RETURNING id, created_at
    `;

    // Get support email from environment or use default
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.RESEND_FROM_EMAIL || "support@novafreight.io";
    
    // Format subject
    const emailSubject = subject 
      ? `Contact Form: ${subject} - ${name}`
      : `Contact Form Submission from ${name}`;

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contact Form Submission</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1f2937; margin-top: 0; font-size: 18px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Contact Information</h2>
              <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a></p>
              ${subject ? `<p style="margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>` : ''}
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px;">
              <h2 style="color: #1f2937; margin-top: 0; font-size: 18px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Message</h2>
              <p style="white-space: pre-wrap; color: #4b5563; line-height: 1.8;">${message}</p>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This message was sent from the NOVA Build contact form.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
New Contact Form Submission

Contact Information:
- Name: ${name}
- Email: ${email}
${subject ? `- Subject: ${subject}` : ''}

Message:
${message}

---
This message was sent from the NOVA Build contact form.
    `.trim();

    // Send email to support team
    const result = await sendEmail({
      to: supportEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    if (!result.success) {
      console.error("[Contact Form] Failed to send email:", result.error);
      return NextResponse.json(
        { error: "Failed to send message. Please try again later." },
        { status: 500 }
      );
    }

    // Optionally send confirmation email to user
    try {
      await sendEmail({
        to: email,
        subject: "We've received your message - NOVA Build",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Thank You for Contacting Us</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                <p style="color: #1f2937; font-size: 16px;">Hi ${name},</p>
                <p style="color: #4b5563;">We've received your message and our support team will get back to you as soon as possible, typically within 24 hours.</p>
                <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Your Message:</strong></p>
                  <p style="margin: 10px 0 0 0; color: #4b5563; white-space: pre-wrap; font-size: 14px;">${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
                </div>
                <p style="color: #4b5563;">If you have any urgent questions, please call us at <a href="tel:+18005551234" style="color: #667eea;">(800) 555-1234</a>.</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Best regards,<br>The NOVA Build Team</p>
              </div>
            </body>
          </html>
        `,
        text: `Hi ${name},\n\nWe've received your message and our support team will get back to you as soon as possible, typically within 24 hours.\n\nYour Message:\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\n\nIf you have any urgent questions, please call us at (800) 555-1234.\n\nBest regards,\nThe NOVA Build Team`,
      });
    } catch (confirmationError) {
      // Log but don't fail the request if confirmation email fails
      console.error("[Contact Form] Failed to send confirmation email:", confirmationError);
    }

    logSecurityEvent('contact_form_submitted', undefined, { 
      messageId: savedMessage.id,
      email: email.substring(0, 3) + '***' // Partial email for privacy
    });

    const response = NextResponse.json({
      success: true,
      message: "Message sent successfully",
      messageId: savedMessage.id,
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("[Contact Form] Error processing contact form:", error);
    
    logSecurityEvent('contact_form_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "An unexpected error occurred. Please try again later.",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

