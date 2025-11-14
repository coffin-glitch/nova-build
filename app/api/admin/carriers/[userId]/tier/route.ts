import sql from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { redisConnection } from "@/lib/notification-queue";
import { clearCarrierRelatedCaches } from "@/lib/cache-invalidation";

// GET - Get user's current tier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireApiAdmin(request);
    const { userId } = await params;

    const result = await sql`
      SELECT 
        COALESCE(cp.notification_tier, 'standard') as tier
      FROM carrier_profiles cp
      WHERE cp.supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Carrier profile not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      ok: true, 
      tier: result[0].tier || 'standard' 
    });
  } catch (error) {
    console.error("Error fetching user tier:", error);
    return NextResponse.json({ 
      error: "Failed to fetch tier" 
    }, { status: 500 });
  }
}

// PUT - Update user's tier
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireApiAdmin(request);
    const { userId } = await params;
    const { tier } = await request.json();

    // Validate tier
    if (!['premium', 'standard', 'new'].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier. Must be 'premium', 'standard', or 'new'" }, { status: 400 });
    }

    // Update tier
    await sql`
      UPDATE carrier_profiles 
      SET notification_tier = ${tier}, updated_at = NOW()
      WHERE supabase_user_id = ${userId}
    `;

    // CRITICAL: Invalidate Redis cache so new tier takes effect immediately
    await redisConnection.del(`user_tier:${userId}`);
    
    // Clear other related caches
    await clearCarrierRelatedCaches(userId);

    return NextResponse.json({ 
      ok: true, 
      tier,
      message: `Tier updated to ${tier}` 
    });
  } catch (error) {
    console.error("Error updating user tier:", error);
    return NextResponse.json({ 
      error: "Failed to update tier" 
    }, { status: 500 });
  }
}

