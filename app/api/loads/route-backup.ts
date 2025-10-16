import { db } from "@/lib/db-local";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const equipment = searchParams.get("equipment");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get the database connection
    // const db = roleManager.getDb();

    // Build the query with filters
        let query = `
          SELECT 
            rr_number,
            tm_number,
            status_code,
            pickup_date,
            pickup_time,
            delivery_date,
            delivery_time,
            equipment,
            weight,
            revenue,
            purchase,
            net,
            margin,
            customer_name,
            customer_ref,
            driver_name,
            origin_city,
            origin_state,
            destination_city,
            destination_state,
            vendor_name,
            dispatcher_name,
            stops,
            miles,
            published,
            archived,
            created_at,
            updated_at
          FROM loads
          WHERE published = 1 AND archived = 0
        `;

    const params: any[] = [];

    // Add filters
    if (origin) {
      query += ` AND (
        LOWER(origin_city) LIKE ? OR
        LOWER(origin_state) LIKE ?
      )`;
      params.push(`%${origin.toLowerCase()}%`, `%${origin.toLowerCase()}%`);
    }

    if (destination) {
      query += ` AND (
        LOWER(destination_city) LIKE ? OR
        LOWER(destination_state) LIKE ?
      )`;
      params.push(`%${destination.toLowerCase()}%`, `%${destination.toLowerCase()}%`);
    }

    if (equipment && equipment !== "all") {
      query += ` AND LOWER(equipment) LIKE ?`;
      params.push(`%${equipment.toLowerCase()}%`);
    }

    // Add ordering and pagination
    query += ` ORDER BY pickup_date ASC, created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const loads = db.prepare(query).all(...params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as total FROM loads WHERE published = 1 AND archived = 0`;
        const countParams: any[] = [];

    if (origin) {
      countQuery += ` AND (
        LOWER(origin_city) LIKE ? OR
        LOWER(origin_state) LIKE ?
      )`;
      countParams.push(`%${origin.toLowerCase()}%`, `%${origin.toLowerCase()}%`);
    }

    if (destination) {
      countQuery += ` AND (
        LOWER(destination_city) LIKE ? OR
        LOWER(destination_state) LIKE ?
      )`;
      countParams.push(`%${destination.toLowerCase()}%`, `%${destination.toLowerCase()}%`);
    }

    if (equipment && equipment !== "all") {
      countQuery += ` AND LOWER(equipment) LIKE ?`;
      countParams.push(`%${equipment.toLowerCase()}%`);
    }

    const countResult = db.prepare(countQuery).all(...countParams);

    // Defensive handling: select "as total" returns [{total: num}] but TypeScript can't be sure.
    const countRow = countResult[0] as { [key: string]: any } | undefined;
    // Try known expected keys or use Object.values fallback
    let total = 0;
    if (countRow) {
      if ('total' in countRow) {
        total = parseInt(countRow.total);
      } else {
        // Fallback: parse first property value in the object
        const value = Object.values(countRow)[0];
        total = parseInt(typeof value === "number" ? value.toString() : value || "0");
      }
    }

    return NextResponse.json({
      loads,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error("Error fetching loads:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "Failed to fetch loads", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}