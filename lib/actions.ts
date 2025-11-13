"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import sql from "./db";
import { createCookieAdapter, getSupabaseServer } from "./supabase";
import { requireAdmin } from "./auth-unified";

// Profile Actions
export async function getCarrierProfile() {
  try {
    const headersList = await headers();
    const cookieStore = await cookies();
    const cookieAdapter = createCookieAdapter(cookieStore);
    const supabase = getSupabaseServer(headersList, cookieAdapter);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = await sql`
      SELECT mc_number, dot_number, phone, dispatch_email 
      FROM carrier_profiles 
      WHERE supabase_user_id = ${user.id}
    `;
    return profile[0] || {};
  } catch (error) {
    console.error("Error fetching profile:", error);
    return {};
  }
}

export async function updateCarrierProfile(formData: FormData) {
  try {
    const headersList = await headers();
    const cookieStore = await cookies();
    const cookieAdapter = createCookieAdapter(cookieStore, true); // readOnly for Server Actions
    const supabase = getSupabaseServer(headersList, cookieAdapter);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const mc_number = formData.get("mc_number") as string;
    const dot_number = formData.get("dot_number") as string;
    const phone = formData.get("phone") as string;
    const dispatch_email = formData.get("dispatch_email") as string;

    await sql`
      INSERT INTO carrier_profiles (supabase_user_id, mc_number, dot_number, phone, dispatch_email, updated_at)
      VALUES (${user.id}, ${mc_number || null}, ${dot_number || null}, ${phone || null}, ${dispatch_email || null}, NOW())
      ON CONFLICT (supabase_user_id) 
      DO UPDATE SET 
        mc_number = ${mc_number || null},
        dot_number = ${dot_number || null},
        phone = ${phone || null},
        dispatch_email = ${dispatch_email || null},
        updated_at = NOW()
    `;

    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

// Admin Actions
export async function getAdminStats() {
  // Check admin role via headers (Supabase-only)
  const headersList = await headers();
  const userId = headersList.get('X-User-Id');
  const userRole = headersList.get('X-User-Role');
  
  if (!userId || userRole !== 'admin') {
    throw new Error('Admin access required');
  }

  try {
    const [
      loadsStats,
      bidsStats,
      carriersStats,
      todayBidsStats
    ] = await Promise.all([
      sql`
        SELECT 
          COUNT(*) as total_loads,
          COUNT(*) FILTER (WHERE published = true) as published_loads
        FROM loads
      `,
      sql`
        SELECT 
          COUNT(*) as total_bids,
          COUNT(*) FILTER (WHERE expires_at::timestamp > NOW()) as active_bids
        FROM telegram_bids
      `,
      sql`
        SELECT 
          COUNT(*) as total_carriers,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as active_carriers
        FROM user_roles 
        WHERE role = 'carrier'
      `,
      sql`
        SELECT COUNT(*) as today_bids
        FROM telegram_bids
        WHERE DATE(received_at::timestamp) = CURRENT_DATE
      `
    ]);

    return {
      totalLoads: parseInt(loadsStats[0]?.total_loads || '0'),
      publishedLoads: parseInt(loadsStats[0]?.published_loads || '0'),
      totalBids: parseInt(bidsStats[0]?.total_bids || '0'),
      activeBids: parseInt(bidsStats[0]?.active_bids || '0'),
      totalCarriers: parseInt(carriersStats[0]?.total_carriers || '0'),
      activeCarriers: parseInt(carriersStats[0]?.active_carriers || '0'),
      todayBids: parseInt(todayBidsStats[0]?.today_bids || '0'),
    };
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return {
      totalLoads: 0,
      publishedLoads: 0,
      totalBids: 0,
      activeBids: 0,
      totalCarriers: 0,
      activeCarriers: 0,
      todayBids: 0,
    };
  }
}

// Bid Actions
export async function getActiveBids() {
  try {
    const bids = await sql`
      SELECT 
        id, bid_number, distance_miles, pickup_timestamp, 
        delivery_timestamp, stops, tag, source_channel, 
        received_at, expires_at, forwarded_to
      FROM telegram_bids 
      ORDER BY received_at DESC 
      LIMIT 50
    `;
    return bids;
  } catch (error) {
    console.error("Error fetching bids:", error);
    return [];
  }
}

export async function getBidOffers(bidId: number) {
  try {
    const offers = await sql`
      SELECT id, COALESCE(supabase_user_id, user_id) as user_id, supabase_user_id, amount_cents, note, created_at
      FROM telegram_bid_offers
      WHERE bid_id = ${bidId}
      ORDER BY created_at DESC
    `;
    return offers;
  } catch (error) {
    console.error("Error fetching bid offers:", error);
    return [];
  }
}

// User Role Actions (Supabase-only)
export async function getUserRoleAction() {
  try {
    const headersList = await headers();
    const cookieStore = await cookies();
    const cookieAdapter = createCookieAdapter(cookieStore);
    const supabase = getSupabaseServer(headersList, cookieAdapter);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    // First check user metadata
    const metadataRole = user.user_metadata?.role;
    if (metadataRole === "admin" || metadataRole === "carrier") {
      return metadataRole;
    }
    
    // If not in metadata, check database
    const roleResult = await sql`
      SELECT role FROM user_roles_cache WHERE supabase_user_id = ${user.id}
    `;
    
    return roleResult[0]?.role || "carrier";
  } catch (error) {
    console.error("Error fetching user role:", error);
    return "carrier";
  }
}

// Debug Actions
export async function testDatabaseConnection() {
  try {
    const result = await sql`SELECT 1 as test`;
    return { success: true, data: result[0] };
  } catch (error) {
    console.error("Database connection test failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Bid Board Actions
export async function getDistinctTags() {
  try {
    const result = await sql`
      SELECT DISTINCT tag
      FROM telegram_bids
      WHERE tag IS NOT NULL
      ORDER BY tag
    `;
    return result.map(row => row.tag);
  } catch (error) {
    console.error("Error fetching distinct tags:", error);
    return [];
  }
}

export async function getPublishedLoads() {
  try {
    const result = await sql`
      SELECT 
        id, 
        pickup_city || ', ' || pickup_state as origin,
        delivery_city || ', ' || delivery_state as destination,
        pickup_date, 
        delivery_date,
        rate, 
        miles, 
        equipment as equipment_type, 
        notes,
        published, 
        created_at, 
        updated_at
      FROM loads
      WHERE published = true
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return result;
  } catch (error) {
    console.error("Error fetching published loads:", error);
    return [];
  }
}

export async function getLoadOffers(loadId?: number) {
  try {
    let query;
    if (loadId) {
      query = sql`
        SELECT 
          lo.*,
          l.load_id,
          l.origin,
          l.destination,
          l.rate as load_rate,
          l.equipment_type,
          l.miles
        FROM load_offers lo
        JOIN loads l ON lo.load_id = l.id
        WHERE lo.load_id = ${loadId}
        ORDER BY lo.created_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          lo.*,
          l.load_id,
          l.origin,
          l.destination,
          l.rate as load_rate,
          l.equipment_type,
          l.miles
        FROM load_offers lo
        JOIN loads l ON lo.load_id = l.id
        ORDER BY lo.created_at DESC
        LIMIT 100
      `;
    }
    
    const result = await query;
    return result;
  } catch (error) {
    console.error("Error fetching load offers:", error);
    return [];
  }
}

export async function acceptOffer(offerId: number) {
  try {
    const userId = await requireAdmin(); // Get userId from requireAdmin
    
    // Get offer details (Supabase-only)
    const offer = await sql`
      SELECT lo.*, l.load_id, l.origin, l.destination, lo.supabase_carrier_user_id
      FROM load_offers lo
      JOIN loads l ON lo.load_id = l.id
      WHERE lo.id = ${offerId} AND lo.status = 'pending'
    `;
    
    if (offer.length === 0) {
      throw new Error("Offer not found or already processed");
    }
    
    const offerData = offer[0];
    const carrierUserId = offerData.supabase_carrier_user_id;
    
    if (!carrierUserId) {
      throw new Error("Carrier user ID not found in offer");
    }
    
    // Create assignment (Supabase-only)
    await sql`
      INSERT INTO assignments (load_id, supabase_user_id, accepted_price, created_at)
      VALUES (${offerData.load_id}, ${carrierUserId}, ${offerData.offer_amount || offerData.price}, NOW())
    `;
    
    // Update offer status
    await sql`
      UPDATE load_offers 
      SET status = 'accepted', updated_at = NOW()
      WHERE id = ${offerId}
    `;
    
    // Reject other offers for the same load
    await sql`
      UPDATE load_offers 
      SET status = 'rejected', updated_at = NOW()
      WHERE load_id = ${offerData.load_id} AND id != ${offerId} AND status = 'pending'
    `;
    
    return { success: true, message: "Offer accepted successfully" };
  } catch (error) {
    console.error("Error accepting offer:", error);
    throw error;
  }
}

export async function rejectOffer(offerId: number) {
  try {
    await requireAdmin();
    
    await sql`
      UPDATE load_offers 
      SET status = 'rejected', updated_at = NOW()
      WHERE id = ${offerId}
    `;
    
    return { success: true, message: "Offer rejected successfully" };
  } catch (error) {
    console.error("Error rejecting offer:", error);
    throw error;
  }
}
