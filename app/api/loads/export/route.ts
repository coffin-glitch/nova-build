import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for load export
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (export is resource-intensive)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    
    // Input validation
    const formatValidation = validateInput(
      { format },
      {
        format: { type: 'string', enum: ['csv', 'excel'], required: false }
      }
    );

    if (!formatValidation.valid) {
      logSecurityEvent('invalid_load_export_format', userId, { errors: formatValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid format: ${formatValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
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

    const loadsArray = Array.isArray(loads) ? loads : [];
    if (format === "csv") {
      return generateCSV(loadsArray);
    } else if (format === "excel") {
      return generateExcel(loadsArray);
    } else {
      const response = NextResponse.json(
        { error: "Invalid format. Must be 'csv' or 'excel'" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

  } catch (error: any) {
    console.error("Error exporting loads:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_export_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to export loads",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
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

  // Note: For file downloads, we can't easily add rate limit headers to the response
  // The rate limit check was already performed above
  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="loads-export-${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
}

function generateExcel(loads: any[]) {
  // For now, return CSV as Excel (you can implement proper Excel generation later)
  const loadsArray = Array.isArray(loads) ? loads : [];
  return generateCSV(loadsArray);
}
