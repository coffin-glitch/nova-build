import { getClerkUserRole, isClerkCarrier } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a carrier
    const isCarrier = await isClerkCarrier(userId);
    if (!isCarrier) {
      return NextResponse.json({ error: "Only carriers can make offers" }, { status: 403 });
    }

    const body = await req.json();
    const { loadRrNumber, offerAmount, notes } = body;

    if (!loadRrNumber || !offerAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if load exists and is published
    const load = await sql`
      SELECT rr_number, published FROM loads 
      WHERE rr_number = ${loadRrNumber} AND published = true
    `;

    if (!load || load.length === 0) {
      return NextResponse.json({ error: "Load not found or not published" }, { status: 404 });
    }

    // Check if carrier already has an offer for this load
    const existingOffer = await sql`
      SELECT id FROM load_offers 
      WHERE load_rr_number = ${loadRrNumber} AND carrier_user_id = ${userId}
    `;

    if (existingOffer && existingOffer.length > 0) {
      return NextResponse.json({ error: "You already have an offer for this load" }, { status: 409 });
    }

    // Create the offer with 24-hour expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

    const result = await sql`
      INSERT INTO load_offers (load_rr_number, carrier_user_id, offer_amount, notes, status, expires_at, is_expired)
      VALUES (${loadRrNumber}, ${userId}, ${offerAmount}, ${notes || ''}, 'pending', ${expiresAt.toISOString()}, false)
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      offerId: result[0].id,
      message: "Offer submitted successfully" 
    });

  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getClerkUserRole(userId);

    if (userRole === 'admin') {
      // Admin can see all offers (including expired ones)
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
        LEFT JOIN user_roles_cache urc ON lo.carrier_user_id = urc.clerk_user_id
        ORDER BY lo.created_at DESC
      `;
      return NextResponse.json({ offers });
    } else if (userRole === 'carrier') {
      // Carrier can only see their own non-expired offers
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
        WHERE lo.carrier_user_id = ${userId}
        AND (lo.expires_at IS NULL OR lo.expires_at > NOW() OR lo.status != 'pending')
        ORDER BY lo.created_at DESC
      `;
      return NextResponse.json({ offers });
    } else {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

  } catch (error) {
    console.error("Error fetching offers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}