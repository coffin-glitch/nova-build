import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, requireApiAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is carrier (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { loadRrNumber, offerAmount, notes } = body;

    // Input validation
    const validation = validateInput(
      { loadRrNumber, offerAmount, notes },
      {
        loadRrNumber: { 
          required: true, 
          type: 'string', 
          pattern: /^[A-Z0-9\-]+$/,
          maxLength: 50
        },
        offerAmount: { 
          required: true, 
          type: 'number', 
          min: 0,
          max: 1000000 // Max $1M
        },
        notes: { 
          type: 'string', 
          maxLength: 1000,
          required: false
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Check if load exists and is published
    const load = await sql`
      SELECT rr_number, published FROM loads 
      WHERE rr_number = ${loadRrNumber} AND published = true
    `;

    if (!load || load.length === 0) {
      logSecurityEvent('offer_load_not_found', userId, { loadRrNumber });
      const response = NextResponse.json(
        { error: "Load not found or not published" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    // Check if carrier already has an offer for this load (Supabase-only)
    const existingOffer = await sql`
      SELECT id FROM load_offers 
      WHERE load_rr_number = ${loadRrNumber} AND supabase_user_id = ${userId}
    `;

    if (existingOffer && existingOffer.length > 0) {
      logSecurityEvent('duplicate_offer_attempt', userId, { loadRrNumber });
      const response = NextResponse.json(
        { error: "You already have an offer for this load" },
        { status: 409 }
      );
      return addSecurityHeaders(response);
    }

    // Create the offer with 24-hour expiration (Supabase-only)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

    const result = await sql`
      INSERT INTO load_offers (load_rr_number, supabase_user_id, offer_amount, notes, status, expires_at, is_expired)
      VALUES (${loadRrNumber}, ${userId}, ${offerAmount}, ${notes || ''}, 'pending', ${expiresAt.toISOString()}, false)
      RETURNING id
    `;

    logSecurityEvent('offer_created', userId, { 
      loadRrNumber, 
      offerAmount,
      offerId: result[0].id
    });

    const response = NextResponse.json({ 
      success: true, 
      offerId: result[0].id,
      message: "Offer submitted successfully" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error creating offer:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_creation_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin or carrier (Supabase-only)
    let userId: string;
    let userRole: 'admin' | 'carrier';
    
    try {
      const adminAuth = await requireApiAdmin(request);
      userId = adminAuth.userId;
      userRole = 'admin';
    } catch {
      // Not admin, try carrier
      const carrierAuth = await requireApiCarrier(request);
      userId = carrierAuth.userId;
      userRole = 'carrier';
    }

    if (userRole === 'admin') {
      // Admin can see all offers (including expired ones) - Supabase-only
      const offers = await sql`
        SELECT 
          lo.*,
          l.origin_city, l.origin_state, l.destination_city, l.destination_state,
          l.pickup_date, l.delivery_date, l.equipment, l.total_miles,
          urc.email as carrier_email,
          CASE 
            WHEN lo.expires_at < NOW() AND lo.status = 'pending' THEN true
            ELSE lo.is_expired
          END as is_expired,
          CASE 
            WHEN lo.expires_at < NOW() AND lo.status = 'pending' THEN 'expired'
            ELSE lo.status
          END as effective_status
        FROM load_offers lo
        JOIN loads l ON lo.load_rr_number = l.rr_number
        LEFT JOIN user_roles_cache urc ON lo.supabase_user_id = urc.supabase_user_id
        ORDER BY lo.created_at DESC
      `;
      logSecurityEvent('offers_accessed_admin', userId);
      const response = NextResponse.json({ offers });
      return addSecurityHeaders(response);
    } else if (userRole === 'carrier') {
      // Carrier can only see their own non-expired offers - Supabase-only
      const offers = await sql`
        SELECT 
          lo.*,
          l.origin_city, l.origin_state, l.destination_city, l.destination_state,
          l.pickup_date, l.delivery_date, l.equipment, l.total_miles,
          CASE 
            WHEN lo.expires_at < NOW() AND lo.status = 'pending' THEN true
            ELSE lo.is_expired
          END as is_expired,
          CASE 
            WHEN lo.expires_at < NOW() AND lo.status = 'pending' THEN 'expired'
            ELSE lo.status
          END as effective_status
        FROM load_offers lo
        JOIN loads l ON lo.load_rr_number = l.rr_number
        WHERE lo.supabase_user_id = ${userId}
        AND (lo.expires_at IS NULL OR lo.expires_at > NOW() OR lo.status != 'pending')
        ORDER BY lo.created_at DESC
      `;
      logSecurityEvent('offers_accessed_carrier', userId);
      const response = NextResponse.json({ offers });
      return addSecurityHeaders(response);
    } else {
      const response = NextResponse.json({ error: "Access denied" }, { status: 403 });
      return addSecurityHeaders(response);
    }

  } catch (error: any) {
    console.error("Error fetching offers:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Admin access required" || error.message === "Carrier access required") {
      if (error.message === "Unauthorized") {
        return unauthorizedResponse();
      }
      return forbiddenResponse(error.message);
    }
    
    logSecurityEvent('offers_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}