import { getClerkUserRole, isClerkCarrier } from "@/lib/clerk-server";
import { db } from "@/lib/db-local";
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
    const load = db.prepare(`
      SELECT rr_number, published FROM loads 
      WHERE rr_number = ? AND published = 1
    `).all(loadRrNumber);

    if (!load || load.length === 0) {
      return NextResponse.json({ error: "Load not found or not published" }, { status: 404 });
    }

    // Check if carrier already has an offer for this load
    const existingOffer = db.prepare(`
      SELECT id FROM load_offers 
      WHERE load_rr_number = ? AND carrier_user_id = ?
    `).all(loadRrNumber, userId);

    if (existingOffer && existingOffer.length > 0) {
      return NextResponse.json({ error: "You already have an offer for this load" }, { status: 409 });
    }

    // Create the offer
    const result = db.prepare(`
      INSERT INTO load_offers (load_rr_number, carrier_user_id, offer_amount, notes, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(loadRrNumber, userId, offerAmount, notes || '');

    return NextResponse.json({ 
      success: true, 
      offerId: result.lastInsertRowid,
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
      // Admin can see all offers
      const offers = db.prepare(`
        SELECT 
          lo.*,
          l.origin_city, l.origin_state, l.destination_city, l.destination_state,
          l.pickup_date, l.delivery_date, l.equipment, l.weight,
          urc.email as carrier_email
        FROM load_offers lo
        JOIN loads l ON lo.load_rr_number = l.rr_number
        LEFT JOIN user_roles_cache urc ON lo.carrier_user_id = urc.clerk_user_id
        ORDER BY lo.created_at DESC
      `).all();
      return NextResponse.json({ offers });
    } else if (userRole === 'carrier') {
      // Carrier can only see their own offers
      const offers = db.prepare(`
        SELECT 
          lo.*,
          l.origin_city, l.origin_state, l.destination_city, l.destination_state,
          l.pickup_date, l.delivery_date, l.equipment, l.weight
        FROM load_offers lo
        JOIN loads l ON lo.load_rr_number = l.rr_number
        WHERE lo.carrier_user_id = ?
        ORDER BY lo.created_at DESC
      `).all(userId);
      return NextResponse.json({ offers });
    } else {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

  } catch (error) {
    console.error("Error fetching offers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}