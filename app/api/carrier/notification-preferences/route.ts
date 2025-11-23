import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/load-matching";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/notification-preferences - Get notification preferences
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for read-only carrier operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
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

    const preferences = await getNotificationPreferences(userId);

    if (!preferences) {
      return NextResponse.json(
        { error: "Failed to get preferences" },
        { status: 500 }
      );
    }

    logSecurityEvent('notification_preferences_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: preferences 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_preferences_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch preferences",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

// PUT /api/carrier/notification-preferences - Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const preferences = await request.json();

    // Input validation - validate preferences object structure
    const validation = validateInput(
      { preferences },
      {
        preferences: { 
          required: true, 
          type: 'object'
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notification_preferences_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const result = await updateNotificationPreferences(userId, preferences);

    if (!result.success) {
      logSecurityEvent('notification_preferences_update_failed', userId, { error: result.error });
      const response = NextResponse.json(
        { error: result.error || "Failed to update preferences" },
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('notification_preferences_updated', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Preferences updated successfully" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_preferences_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update preferences",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
