import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const equipment = searchParams.get("equipment");

    // Build the query with filters
    let query = sql`
      SELECT 
        id,
        origin,
        destination,
        equipment,
        miles,
        rate,
        pickup_date,
        delivery_date,
        description,
        created_at
      FROM loads 
      WHERE status = 'published'
    `;

    const conditions = [];
    const params = [];

    if (origin) {
      conditions.push(`LOWER(origin) LIKE LOWER($${params.length + 1})`);
      params.push(`%${origin}%`);
    }

    if (destination) {
      conditions.push(`LOWER(destination) LIKE LOWER($${params.length + 1})`);
      params.push(`%${destination}%`);
    }

    if (equipment && equipment !== "all") {
      conditions.push(`equipment = $${params.length + 1}`);
      params.push(equipment);
    }

    if (conditions.length > 0) {
      query = sql`
        SELECT 
          id,
          origin,
          destination,
          equipment,
          miles,
          rate,
          pickup_date,
          delivery_date,
          description,
          created_at
        FROM loads 
        WHERE status = 'published' AND ${sql.unsafe(conditions.join(' AND '))}
        ORDER BY created_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          id,
          origin,
          destination,
          equipment,
          miles,
          rate,
          pickup_date,
          delivery_date,
          description,
          created_at
        FROM loads 
        WHERE status = 'published'
        ORDER BY created_at DESC
      `;
    }

    const loads = await query;

    return NextResponse.json({ 
      loads: loads || [],
      count: loads?.length || 0
    });

  } catch (error: any) {
    console.error("Error fetching loads:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch loads",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
