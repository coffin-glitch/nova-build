import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Mark expired offers as expired
    // Only update if expires_at and is_expired columns exist
    // Check if columns exist first
    const hasExpiresAt = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'load_offers' AND column_name = 'expires_at'
      LIMIT 1
    `;
    
    if (hasExpiresAt.length === 0) {
      // expires_at column doesn't exist, skip expiration logic
      return NextResponse.json({ 
        success: true, 
        expiredCount: 0,
        message: 'Expiration not configured (expires_at column not found)' 
      });
    }
    
    const result = await sql`
      UPDATE load_offers 
      SET is_expired = true, status = 'expired'
      WHERE expires_at < NOW() 
      AND status = 'pending' 
      AND is_expired = false
      RETURNING id, load_rr_number, supabase_carrier_user_id, carrier_user_id
    `;

    // Create notifications for expired offers (Supabase-only)
    if (result && result.length > 0) {
      for (const offer of result) {
        const carrierSupabaseUserId = offer.supabase_carrier_user_id || offer.carrier_user_id;
        
        await sql`
          INSERT INTO carrier_notifications (
            supabase_user_id,
            carrier_user_id,
            type,
            title,
            message,
            is_read,
            created_at
          ) VALUES (
            ${carrierSupabaseUserId},
            ${offer.carrier_user_id},
            'offer_expired',
            'Offer Expired',
            'Your offer for load ${offer.load_rr_number} has expired and is no longer active.',
            false,
            NOW()
          )
        `;
      }
    }

    return NextResponse.json({ 
      success: true, 
      expiredCount: result.length,
      message: `Expired ${result.length} offers` 
    });

  } catch (error) {
    console.error("Error expiring offers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Check if expires_at column exists
    const hasExpiresAt = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'load_offers' AND column_name = 'expires_at'
      LIMIT 1
    `;
    
    if (hasExpiresAt.length === 0) {
      // expires_at column doesn't exist
      return NextResponse.json({ 
        expiringSoon: 0,
        expired: 0
      });
    }
    
    // Get count of offers that will expire soon (within 1 hour)
    const expiringSoon = await sql`
      SELECT COUNT(*) as count
      FROM load_offers 
      WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
      AND status = 'pending' 
      AND is_expired = false
    `;

    // Get count of already expired offers
    const expired = await sql`
      SELECT COUNT(*) as count
      FROM load_offers 
      WHERE expires_at < NOW()
      AND status = 'pending' 
      AND is_expired = false
    `;

    return NextResponse.json({ 
      expiringSoon: parseInt(expiringSoon[0].count),
      expired: parseInt(expired[0].count)
    });

  } catch (error) {
    console.error("Error getting expiration stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
