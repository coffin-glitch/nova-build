import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Get admin profile
    const profile = await sql`
      SELECT 
        ap.*,
        ur.email as system_email,
        ur.created_at as account_created_at
      FROM user_roles_cache ur
      LEFT JOIN admin_profiles ap ON ur.supabase_user_id = ap.supabase_user_id
      WHERE ur.supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (profile.length === 0) {
      // Return default profile if none exists
      const userInfo = await sql`
        SELECT email, created_at
        FROM user_roles_cache
        WHERE supabase_user_id = ${userId}
        LIMIT 1
      `;

      logSecurityEvent('admin_profile_accessed', userId);
      
      const defaultResponse = NextResponse.json({
        ok: true,
        data: {
          supabase_user_id: userId,
          display_name: null,
          display_email: userInfo[0]?.email || null,
          display_phone: null,
          title: null,
          department: null,
          bio: null,
          preferred_contact_method: 'email',
          notification_preferences: {},
          avatar_url: null,
          theme_preference: 'system',
          language_preference: 'en',
          system_email: userInfo[0]?.email || null,
          account_created_at: userInfo[0]?.created_at || null
        }
      });
      
      return addRateLimitHeaders(addSecurityHeaders(defaultResponse), rateLimit);
    }

    logSecurityEvent('admin_profile_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: profile[0]
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching admin profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_profile_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch admin profile",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    const body = await request.json();

    const {
      display_name,
      display_email,
      display_phone,
      title,
      department,
      bio,
      preferred_contact_method,
      notification_preferences,
      avatar_url,
      theme_preference,
      language_preference
    } = body;

    // Input validation
    const validation = validateInput(
      { display_name, display_email, display_phone, title, department, bio, preferred_contact_method, avatar_url, theme_preference, language_preference },
      {
        display_name: { type: 'string', maxLength: 100, required: false },
        display_email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 255, required: false },
        display_phone: { type: 'string', maxLength: 20, required: false },
        title: { type: 'string', maxLength: 100, required: false },
        department: { type: 'string', maxLength: 100, required: false },
        bio: { type: 'string', maxLength: 1000, required: false },
        preferred_contact_method: { type: 'string', enum: ['email', 'phone', 'both'], required: false },
        avatar_url: { type: 'string', maxLength: 500, required: false },
        theme_preference: { type: 'string', enum: ['light', 'dark', 'system'], required: false },
        language_preference: { type: 'string', maxLength: 10, required: false },
        notification_preferences: { type: 'object', required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_admin_profile_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Prepare notification preferences as JSONB
    const notificationPrefs = notification_preferences 
      ? JSON.stringify(notification_preferences) 
      : '{}';

    // Upsert admin profile
    const result = await sql`
      INSERT INTO admin_profiles (
        supabase_user_id,
        display_name,
        display_email,
        display_phone,
        title,
        department,
        bio,
        preferred_contact_method,
        notification_preferences,
        avatar_url,
        theme_preference,
        language_preference
      ) VALUES (
        ${userId},
        ${display_name || null},
        ${display_email || null},
        ${display_phone || null},
        ${title || null},
        ${department || null},
        ${bio || null},
        ${preferred_contact_method || 'email'},
        ${notificationPrefs}::jsonb,
        ${avatar_url || null},
        ${theme_preference || 'system'},
        ${language_preference || 'en'}
      )
      ON CONFLICT (supabase_user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        display_email = EXCLUDED.display_email,
        display_phone = EXCLUDED.display_phone,
        title = EXCLUDED.title,
        department = EXCLUDED.department,
        bio = EXCLUDED.bio,
        preferred_contact_method = EXCLUDED.preferred_contact_method,
        notification_preferences = EXCLUDED.notification_preferences,
        avatar_url = EXCLUDED.avatar_url,
        theme_preference = EXCLUDED.theme_preference,
        language_preference = EXCLUDED.language_preference,
        updated_at = NOW()
      RETURNING *
    `;

    logSecurityEvent('admin_profile_updated', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: result[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating admin profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_profile_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update admin profile",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

