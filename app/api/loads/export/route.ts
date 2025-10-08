import sql from "@/lib/db.server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    
    const body = await request.json();
    const { filters = {}, rrNumbers = [] } = body;

    // For now, let's use a simplified query without complex filtering
    // TODO: Add proper filtering logic later
    const loads = await sql`
      SELECT 
        rr_number,
        COALESCE(tm_number, '') as tm_number,
        COALESCE(status_code, 'active') as status_code,
        pickup_date,
        COALESCE(pickup_time, '') as pickup_window,
        delivery_date,
        COALESCE(delivery_time, '') as delivery_window,
        COALESCE(revenue, 0) as revenue,
        COALESCE(purchase, 0) as purchase,
        COALESCE(net, 0) as net,
        COALESCE(margin, 0) as margin,
        equipment,
        COALESCE(customer_name, '') as customer_name,
        COALESCE(driver_name, '') as driver_name,
        COALESCE(miles, 0) as total_miles,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        COALESCE(vendor_name, '') as vendor_name,
        COALESCE(dispatcher_name, '') as dispatcher_name,
        updated_at,
        published
      FROM loads
      ORDER BY updated_at DESC
    `;

    if (format === "csv") {
      return generateCSV(loads);
    } else if (format === "excel") {
      return generateExcel(loads);
    } else {
      return NextResponse.json(
        { error: "Invalid format. Must be 'csv' or 'excel'" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Error exporting loads:", error);
    return NextResponse.json(
      { error: "Failed to export loads", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function generateCSV(loads: any[]) {
  const headers = [
    "RR Number",
    "TM Number", 
    "Status",
    "Pickup Date",
    "Pickup Window",
    "Delivery Date",
    "Delivery Window",
    "Revenue",
    "Purchase",
    "Net",
    "Margin",
    "Equipment",
    "Customer Name",
    "Driver Name",
    "Total Miles",
    "Origin City",
    "Origin State",
    "Destination City",
    "Destination State",
    "Vendor Name",
    "Dispatcher Name",
    "Updated At",
    "Published"
  ];

  const csvContent = [
    headers.join(","),
    ...loads.map(load => [
      load.rr_number || "",
      load.tm_number || "",
      load.status_code || "",
      load.pickup_date || "",
      load.pickup_window || "",
      load.delivery_date || "",
      load.delivery_window || "",
      load.revenue || 0,
      load.purchase || 0,
      load.net || 0,
      load.margin || 0,
      load.equipment || "",
      load.customer_name || "",
      load.driver_name || "",
      load.total_miles || 0,
      load.origin_city || "",
      load.origin_state || "",
      load.destination_city || "",
      load.destination_state || "",
      load.vendor_name || "",
      load.dispatcher_name || "",
      load.updated_at || "",
      load.published ? "Yes" : "No"
    ].map(field => `"${field}"`).join(","))
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="loads-export-${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
}

function generateExcel(loads: any[]) {
  // For now, return CSV as Excel (you can implement proper Excel generation later)
  return generateCSV(loads);
}
