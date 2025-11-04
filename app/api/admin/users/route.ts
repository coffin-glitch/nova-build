import { addSecurityHeaders, validateInput } from "@/lib/api-security";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Input validation
    const validation = validateInput({ limit, offset }, {
      limit: { type: 'number', min: 1, max: 100 },
      offset: { type: 'number', min: 0 }
    });

    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    const users = await sql`
      SELECT 
        ur.supabase_user_id as user_id,
        ur.supabase_user_id,
        ur.role,
        ur.email,
        ur.created_at as role_created_at,
        cp.legal_name,
        cp.mc_number,
        cp.dot_number,
        cp.phone,
        cp.contact_name,
        cp.created_at as profile_created_at
      FROM user_roles_cache ur
      LEFT JOIN carrier_profiles cp ON ur.supabase_user_id = cp.supabase_user_id
      WHERE ur.supabase_user_id IS NOT NULL
      ORDER BY ur.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalCount = await sql`
      SELECT COUNT(*) as count FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    `;

    const response = NextResponse.json({
      ok: true,
      data: users.map((u: any) => ({
        user_id: u.supabase_user_id || u.user_id,
        supabase_user_id: u.supabase_user_id,
        email: u.email,
        role: u.role,
        role_created_at: u.role_created_at,
        legal_name: u.legal_name,
        company_name: u.legal_name || u.company_name || 'N/A',
        mc_number: u.mc_number,
        dot_number: u.dot_number,
        phone: u.phone,
        contact_name: u.contact_name,
        profile_created_at: u.profile_created_at
      })),
      pagination: {
        limit,
        offset,
        total: parseInt(totalCount[0]?.count || "0"),
        hasMore: users.length === limit,
      },
    });
    
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error("Admin users API error:", error);
    const response = NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const body = await request.json();
    const { user_id, role } = body;

    // Input validation
    const validation = validateInput({ user_id, role }, {
      user_id: { required: true, type: 'string', minLength: 1 },
      role: { required: true, type: 'string', pattern: /^(admin|carrier)$/ }
    });

    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user email from Supabase Auth or existing record
    let userEmail = '';
    
    // First, try to get email from existing record
    const existingRecord = await sql`
      SELECT email FROM user_roles_cache WHERE supabase_user_id = ${user_id} LIMIT 1
    `;
    
    if (existingRecord.length > 0 && existingRecord[0].email) {
      userEmail = existingRecord[0].email;
    } else {
      // Fallback: Get email from Supabase Auth
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: { user }, error } = await supabase.auth.admin.getUserById(user_id);
          
          if (!error && user?.email) {
            userEmail = user.email;
          }
        }
      } catch (supabaseError) {
        console.error("Error fetching email from Supabase:", supabaseError);
      }
    }
    
    // If still no email, use a placeholder (shouldn't happen, but prevent constraint violation)
    if (!userEmail) {
      userEmail = `user_${user_id.substring(0, 8)}@placeholder.local`;
    }

    // Update user role in user_roles_cache (Supabase-only)
    await sql`
      INSERT INTO user_roles_cache (supabase_user_id, role, email, last_synced)
      VALUES (${user_id}, ${role}, ${userEmail}, NOW())
      ON CONFLICT (supabase_user_id) DO UPDATE SET 
        role = ${role},
        email = COALESCE(EXCLUDED.email, user_roles_cache.email),
        last_synced = NOW()
    `;

    const response = NextResponse.json({
      ok: true,
      message: `User role updated to ${role}`,
    });
    
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error("Admin users PATCH API error:", error);
    const response = NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}
