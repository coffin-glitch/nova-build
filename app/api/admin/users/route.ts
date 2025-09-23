import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db.server";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const users = await sql`
      SELECT 
        ur.user_id,
        ur.role,
        ur.created_at as role_created_at,
        cp.legal_name,
        cp.mc_number,
        cp.dot_number,
        cp.phone,
        cp.contact_name,
        cp.created_at as profile_created_at
      FROM public.user_roles ur
      LEFT JOIN public.carrier_profiles cp ON ur.user_id = cp.clerk_user_id
      ORDER BY ur.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalCount = await sql`
      SELECT COUNT(*) as count FROM public.user_roles
    `;

    return NextResponse.json({
      ok: true,
      data: users,
      pagination: {
        limit,
        offset,
        total: parseInt(totalCount[0]?.count || "0"),
        hasMore: users.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Admin users API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
      return NextResponse.json(
        { ok: false, error: "Missing user_id or role" },
        { status: 400 }
      );
    }

    if (!["admin", "carrier"].includes(role)) {
      return NextResponse.json(
        { ok: false, error: "Invalid role. Must be 'admin' or 'carrier'" },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO public.user_roles (user_id, role)
      VALUES (${user_id}, ${role})
      ON CONFLICT (user_id) DO UPDATE SET role = ${role}
    `;

    return NextResponse.json({
      ok: true,
      message: `User role updated to ${role}`,
    });
  } catch (error: any) {
    console.error("Admin users PATCH API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
