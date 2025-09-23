import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db.server";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { ok: false, error: "Only Excel files (.xlsx, .xls) are supported" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Excel file appears to be empty or has no data rows" },
        { status: 400 }
      );
    }

    // Parse EAX Excel format
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as any[][];
    
    console.log("Excel headers:", headers);
    console.log("Data rows count:", dataRows.length);

    // Map Excel columns to EAX load format
    const parsedLoads = dataRows.map((row, index) => {
      // Map based on common EAX Excel column names
      const getColumnValue = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const headerIndex = headers.findIndex(h => 
            h && h.toLowerCase().includes(name.toLowerCase())
          );
          if (headerIndex !== -1 && row[headerIndex]) {
            return row[headerIndex];
          }
        }
        return null;
      };

      return {
        rr_number: getColumnValue(['rr#', 'rr_number', 'rr number', 'rr']) || `EAX_${Date.now()}_${index}`,
        tm_number: getColumnValue(['tm#', 'tm_number', 'load#', 'load number', 'tm']),
        status_code: getColumnValue(['sts', 'status', 'status_code']),
        pickup_date: getColumnValue(['pickup date', 'pickup_date', 'pickup']),
        pickup_window: getColumnValue(['pickup time', 'pickup window', 'pickup_window']),
        delivery_date: getColumnValue(['delivery date', 'delivery_date', 'delivery']),
        delivery_window: getColumnValue(['delivery time', 'delivery window', 'delivery_window']),
        equipment: getColumnValue(['eqp', 'equipment', 'equipment_type']),
        total_miles: getColumnValue(['tot miles', 'total miles', 'miles', 'distance']),
        revenue: getColumnValue(['rev$', 'revenue', 'rate', 'price']),
        purchase: getColumnValue(['purch tr$', 'purchase', 'cost']),
        net: getColumnValue(['net', 'profit']),
        margin: getColumnValue(['mrg$', 'margin', 'margin%']),
        customer_name: getColumnValue(['cust nm', 'customer', 'customer_name', 'shipper']),
        customer_ref: getColumnValue(['cust ref#', 'customer ref#', 'customer_ref', 'ref']),
        driver_name: getColumnValue(['driver nm', 'driver', 'driver_name']),
        origin_city: getColumnValue(['origin', 'origin_city', 'pickup city']),
        origin_state: getColumnValue(['origin state', 'origin_state', 'pickup state']),
        destination_city: getColumnValue(['destination', 'destination_city', 'delivery city']),
        destination_state: getColumnValue(['destination state', 'destination_state', 'delivery state']),
        vendor_name: getColumnValue(['vendor', 'vendor_name', 'carrier']),
        dispatcher_name: getColumnValue(['dispatcher', 'dispatcher_name', 'dispatch']),
      };
    });

    console.log("Parsed loads sample:", parsedLoads[0]);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Insert into database
    try {
      for (const load of parsedLoads) {
        try {
          // Insert into eax_loads_raw
          await sql`
            INSERT INTO public.eax_loads_raw (
              rr_number, tm_number, status_code, pickup_date, pickup_window, 
              delivery_date, delivery_window, equipment, total_miles, revenue, 
              purchase, net, margin, customer_name, customer_ref, driver_name,
              origin_city, origin_state, destination_city, destination_state, 
              vendor_name, dispatcher_name, updated_at
            ) VALUES (
              ${load.rr_number}, ${load.tm_number}, ${load.status_code}, 
              ${load.pickup_date}, ${load.pickup_window}, ${load.delivery_date}, 
              ${load.delivery_window}, ${load.equipment}, ${load.total_miles}, 
              ${load.revenue}, ${load.purchase}, ${load.net}, ${load.margin}, 
              ${load.customer_name}, ${load.customer_ref}, ${load.driver_name},
              ${load.origin_city}, ${load.origin_state}, ${load.destination_city}, 
              ${load.destination_state}, ${load.vendor_name}, ${load.dispatcher_name}, 
              now()
            )
            ON CONFLICT (rr_number) DO UPDATE SET
              tm_number = excluded.tm_number,
              status_code = excluded.status_code,
              pickup_date = excluded.pickup_date,
              pickup_window = excluded.pickup_window,
              delivery_date = excluded.delivery_date,
              delivery_window = excluded.delivery_window,
              equipment = excluded.equipment,
              total_miles = excluded.total_miles,
              revenue = excluded.revenue,
              purchase = excluded.purchase,
              net = excluded.net,
              margin = excluded.margin,
              customer_name = excluded.customer_name,
              customer_ref = excluded.customer_ref,
              driver_name = excluded.driver_name,
              origin_city = excluded.origin_city,
              origin_state = excluded.origin_state,
              destination_city = excluded.destination_city,
              destination_state = excluded.destination_state,
              vendor_name = excluded.vendor_name,
              dispatcher_name = excluded.dispatcher_name,
              updated_at = now()
          `;

          // Insert into loads table
          const result = await sql`
            INSERT INTO public.loads (
              rr_number, tm_number, status_code, pickup_date, pickup_window,
              delivery_date, delivery_window, equipment, total_miles, revenue,
              purchase, net, margin, customer_name, customer_ref, driver_name,
              origin_city, origin_state, destination_city, destination_state,
              vendor_name, dispatcher_name, published, created_at, updated_at
            ) VALUES (
              ${load.rr_number}, ${load.tm_number}, ${load.status_code},
              ${load.pickup_date}, ${load.pickup_window}, ${load.delivery_date},
              ${load.delivery_window}, ${load.equipment}, ${load.total_miles},
              ${load.revenue}, ${load.purchase}, ${load.net}, ${load.margin},
              ${load.customer_name}, ${load.customer_ref}, ${load.driver_name},
              ${load.origin_city}, ${load.origin_state}, ${load.destination_city},
              ${load.destination_state}, ${load.vendor_name}, ${load.dispatcher_name},
              false, now(), now()
            )
            ON CONFLICT (rr_number) DO UPDATE SET
              tm_number = excluded.tm_number,
              status_code = excluded.status_code,
              pickup_date = excluded.pickup_date,
              pickup_window = excluded.pickup_window,
              delivery_date = excluded.delivery_date,
              delivery_window = excluded.delivery_window,
              equipment = excluded.equipment,
              total_miles = excluded.total_miles,
              revenue = excluded.revenue,
              purchase = excluded.purchase,
              net = excluded.net,
              margin = excluded.margin,
              customer_name = excluded.customer_name,
              customer_ref = excluded.customer_ref,
              driver_name = excluded.driver_name,
              origin_city = excluded.origin_city,
              origin_state = excluded.origin_state,
              destination_city = excluded.destination_city,
              destination_state = excluded.destination_state,
              vendor_name = excluded.vendor_name,
              dispatcher_name = excluded.dispatcher_name,
              updated_at = now()
            RETURNING xmax = 0 as inserted
          `;

          if (result?.[0]?.inserted) {
            inserted++;
          } else {
            updated++;
          }
        } catch (error) {
          console.error(`Error processing load ${load.rr_number}:`, error);
          errors++;
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Successfully processed ${parsedLoads.length} loads from Excel file`,
        data: {
          file_name: file.name,
          file_size: file.size,
          rows_processed: parsedLoads.length,
          inserted,
          updated,
          errors,
        }
      });

    } catch (dbError) {
      console.error("Database error during Excel processing:", dbError);
      return NextResponse.json(
        { 
          ok: false,
          error: "Failed to save data to database",
          details: dbError instanceof Error ? dbError.message : "Unknown database error"
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Excel upload error:", error);
    
    if (error instanceof Error && error.message.includes("403")) {
      return NextResponse.json(
        { ok: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { 
        ok: false,
        error: "Failed to process Excel file",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
