import { roleManager } from "@/lib/role-manager";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db-local";

export async function POST(req: Request) {
  try {
    // For now, allow unauthenticated requests for testing
    // TODO: Implement proper authentication
    const { userId } = await auth().catch(() => ({ userId: null }));
    
    // If no user ID, create a test user ID for demo purposes
    const testUserId = userId || 'test_carrier_user';

    const body = await req.json();
    const { loadRrNumber, offerAmount, notes } = body;

    if (!loadRrNumber || !offerAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

        // For testing, skip role check
        // TODO: Implement proper role checking
        // const userRole = await roleManager.getUserRole(testUserId);
        // if (userRole !== 'carrier') {
        //   return NextResponse.json({ error: "Only carriers can make offers" }, { status: 403 });
        // }

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
          WHERE rr_number = ? AND user_id = ?
        `).all(loadRrNumber, testUserId);

    if (existingOffer && existingOffer.length > 0) {
      return NextResponse.json({ error: "You already have an offer for this load" }, { status: 409 });
    }

        // Create the offer
        const result = db.prepare(`
          INSERT INTO load_offers (rr_number, user_id, amount_cents, note)
          VALUES (?, ?, ?, ?)
        `).run(loadRrNumber, testUserId, offerAmount * 100, notes || '');

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

    const userRole = await roleManager.getUserRole(userId);

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