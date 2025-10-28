import { addSecurityHeaders, validateInput } from "@/lib/api-security";
import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db.server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

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
        ur.clerk_user_id as user_id,
        ur.role,
        ur.created_at as role_created_at,
        cp.legal_name,
        cp.mc_number,
        cp.dot_number,
        cp.phone,
        cp.contact_name,
        cp.created_at as profile_created_at
      FROM public.user_roles ur
      LEFT JOIN public.carrier_profiles cp ON ur.clerk_user_id = cp.clerk_user_id
      ORDER BY ur.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalCount = await sql`
      SELECT COUNT(*) as count FROM public.user_roles
    `;

    const response = NextResponse.json({
      ok: true,
      data: users,
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
    await requireAdmin();

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

    await sql`
      INSERT INTO public.user_roles (clerk_user_id, role)
      VALUES (${user_id}, ${role})
      ON CONFLICT (clerk_user_id) DO UPDATE SET role = ${role}
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
