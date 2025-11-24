import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for archive settings
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (critical - system configuration)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'critical'
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
    const enabled = body?.enabled ?? true;

    // Input validation
    const validation = validateInput(
      { enabled },
      {
        enabled: { type: 'boolean', required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_auto_archiving_toggle_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (enabled) {
      // Enable the cron job
      const result = await sql`
        UPDATE cron.job
        SET enabled = true
        WHERE jobname = 'end-of-day-archive'
        RETURNING jobname
      `;

      if (result.length === 0) {
        // Create the cron job if it doesn't exist
        await sql`
          SELECT cron.schedule(
            'end-of-day-archive',
            '59 59 23 * * *',
            $$SELECT set_end_of_day_archived_timestamps()$$
          )
        `;
      }

      logSecurityEvent('auto_archiving_enabled', userId);
      
      const response = NextResponse.json({
        ok: true,
        enabled: true,
        message: 'Auto-archiving enabled'
      });
      
      return addSecurityHeaders(response);
    } else {
      // Disable the cron job
      await sql`
        UPDATE cron.job
        SET enabled = false
        WHERE jobname = 'end-of-day-archive'
        RETURNING jobname
      `;

      logSecurityEvent('auto_archiving_disabled', userId);
      
      const response = NextResponse.json({
        ok: true,
        enabled: false,
        message: 'Auto-archiving disabled'
      });
      
      return addSecurityHeaders(response);
    }
  } catch (error: any) {
    console.error("Error toggling auto-archiving:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('auto_archiving_toggle_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to toggle auto-archiving",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

