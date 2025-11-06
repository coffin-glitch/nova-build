import sql from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

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

      return NextResponse.json({
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
    }

    return NextResponse.json({
      ok: true,
      data: profile[0]
    });

  } catch (error) {
    console.error("Error fetching admin profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin profile", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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

    return NextResponse.json({
      ok: true,
      data: result[0]
    });

  } catch (error) {
    console.error("Error updating admin profile:", error);
    return NextResponse.json(
      { error: "Failed to update admin profile", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

