import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { EAXLoadData, getLoadSummary, parseEAXCSV, parseEAXExcel, validateEAXLoad } from "@/lib/eax-parser";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: "Only Excel (.xlsx, .xls) and CSV (.csv) files are supported" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    
    let jsonData: any[][];
    
    let parsedLoads: EAXLoadData[];
    
    if (file.name.endsWith('.csv')) {
      // Parse CSV file using improved parser
      console.log("Parsing CSV file...");
      const csvText = new TextDecoder().decode(buffer);
      console.log("CSV text length:", csvText.length);
      console.log("CSV first 500 chars:", csvText.substring(0, 500));
      try {
        parsedLoads = parseEAXCSV(csvText);
        console.log("CSV parsing successful, parsed loads:", parsedLoads.length);
      } catch (parseError) {
        console.error("CSV parsing error:", parseError);
        throw parseError;
      }
    } else {
      // Parse Excel file using improved parser
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      parsedLoads = parseEAXExcel(jsonData);
    }

    console.log("File processing started:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.name.endsWith('.csv') ? 'CSV' : 'Excel'
    });

    // Validate parsed loads
    const validationResults = parsedLoads.map(load => ({
      load,
      errors: validateEAXLoad(load)
    }));

    const validLoads = validationResults.filter(result => result.errors.length === 0);
    const invalidLoads = validationResults.filter(result => result.errors.length > 0);

    console.log(`Parsed ${parsedLoads.length} loads: ${validLoads.length} valid, ${invalidLoads.length} invalid`);
    
    if (invalidLoads.length > 0) {
      console.log("Invalid loads:", invalidLoads.slice(0, 5).map(result => ({
        rr_number: result.load.rr_number,
        errors: result.errors
      })));
    }

    // Get load summary statistics
    const summary = getLoadSummary(parsedLoads);
    console.log("Load summary:", summary);

    // Get database connection
    const db = sql;

    // Insert into eax_loads_raw table
    try {
      console.log("Starting database insert for", parsedLoads.length, "loads");
      
      for (const load of parsedLoads) {
        try {
          // Parse dates safely with better validation
          let pickupDate = null;
          let deliveryDate = null;
          
          if (load.pickup_date) {
            try {
              let parsed;
              if (load.pickup_date instanceof Date) {
                parsed = load.pickup_date;
              } else {
                // Handle MM/DD/YY format (common in EAX files)
                const dateStr = load.pickup_date.toString().trim();
                if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
                  // Convert MM/DD/YY to MM/DD/YYYY
                  const [month, day, year] = dateStr.split('/');
                  const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
                  parsed = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                } else {
                  parsed = new Date(load.pickup_date);
                }
              }
              // Check if date is valid and not in the year 0000 (invalid)
              if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
                pickupDate = parsed;
              } else {
                console.error("Invalid pickup date:", load.pickup_date);
              }
            } catch (error) {
              console.error("Error parsing pickup date:", load.pickup_date, error);
            }
          }
          
          if (load.delivery_date) {
            try {
              let parsed;
              if (load.delivery_date instanceof Date) {
                parsed = load.delivery_date;
              } else {
                // Handle MM/DD/YY format (common in EAX files)
                const dateStr = load.delivery_date.toString().trim();
                if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
                  // Convert MM/DD/YY to MM/DD/YYYY
                  const [month, day, year] = dateStr.split('/');
                  const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
                  parsed = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                } else {
                  parsed = new Date(load.delivery_date);
                }
              }
              // Check if date is valid and not in the year 0000 (invalid)
              if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
                deliveryDate = parsed;
              } else {
                console.error("Invalid delivery date:", load.delivery_date);
              }
            } catch (error) {
              console.error("Error parsing delivery date:", load.delivery_date, error);
            }
          }
          
          await db`
            INSERT INTO eax_loads_raw (
              rr_number, tm_number, status_code, pickup_date, pickup_time, pickup_window, delivery_date, delivery_time, delivery_window,
              revenue, purchase, net, margin, equipment, customer_name, customer_ref, driver_name,
              total_miles, origin_city, origin_state, destination_city, destination_state,
              vendor_name, dispatcher_name, load_number, target_buy, max_buy, spot_bid, fuel_surcharge,
              docs_scanned, invoice_date, invoice_audit, purch_tr, net_mrg, cm, nbr_of_stops, stops,
              weight, vendor_dispatch, created_at
            ) VALUES (
              ${load.rr_number}, ${load.tm_number || null}, ${load.status_code || null}, 
              ${pickupDate}, ${load.pickup_time || null}, ${load.pickup_window || null}, 
              ${deliveryDate}, ${load.delivery_time || null}, ${load.delivery_window || null},
              ${load.revenue || null}, ${load.purchase || null}, ${load.net || null}, ${load.margin || null}, 
              ${load.equipment || null}, ${load.customer_name || null}, ${load.customer_ref || null}, ${load.driver_name || null},
              ${load.miles || null}, ${load.origin_city || null}, ${load.origin_state || null}, 
              ${load.destination_city || null}, ${load.destination_state || null},
              ${load.vendor_name || null}, ${load.dispatcher_name || null}, ${load.load_number || null},
              ${load.target_buy || null}, ${load.max_buy || null}, ${load.spot_bid || null}, ${load.fuel_surcharge || 0},
              ${load.docs_scanned || null}, ${load.invoice_date || null}, ${load.invoice_audit || null},
              ${load.purch_tr || null}, ${load.net_mrg || null}, ${load.cm || null}, ${load.nbr_of_stops || null},
              ${load.stops || null}, ${load.weight || null}, ${load.vendor_dispatch || null}, NOW()
            )`;
        } catch (insertError) {
          console.error("Error inserting load:", load.rr_number, insertError);
          console.error("Load data:", JSON.stringify(load, null, 2));
          throw insertError;
        }
      }
      
      console.log("Successfully inserted all loads into eax_loads_raw");

      // Merge from eax_loads_raw to loads table
      console.log("Starting merge from eax_loads_raw to loads table");
      
      // Insert loads one by one to handle conflicts properly
      let mergedCount = 0;
      for (const load of parsedLoads) {
        try {
          // Parse dates safely with better validation for merge
          let pickupDate = null;
          let deliveryDate = null;
          
          if (load.pickup_date) {
            try {
              let parsed;
              if (load.pickup_date instanceof Date) {
                parsed = load.pickup_date;
              } else {
                // Handle MM/DD/YY format (common in EAX files)
                const dateStr = load.pickup_date.toString().trim();
                if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
                  // Convert MM/DD/YY to MM/DD/YYYY
                  const [month, day, year] = dateStr.split('/');
                  const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
                  parsed = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                } else {
                  parsed = new Date(load.pickup_date);
                }
              }
              // Check if date is valid and not in the year 0000 (invalid)
              if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
                pickupDate = parsed;
              }
            } catch (error) {
              // Invalid date, leave as null
            }
          }
          
          if (load.delivery_date) {
            try {
              let parsed;
              if (load.delivery_date instanceof Date) {
                parsed = load.delivery_date;
              } else {
                // Handle MM/DD/YY format (common in EAX files)
                const dateStr = load.delivery_date.toString().trim();
                if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
                  // Convert MM/DD/YY to MM/DD/YYYY
                  const [month, day, year] = dateStr.split('/');
                  const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
                  parsed = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                } else {
                  parsed = new Date(load.delivery_date);
                }
              }
              // Check if date is valid and not in the year 0000 (invalid)
              if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
                deliveryDate = parsed;
              }
            } catch (error) {
              // Invalid date, leave as null
            }
          }

          await db`
            INSERT INTO loads (
              rr_number, tm_number, status_code, origin_city, origin_state, destination_city, destination_state,
              equipment, weight, miles, revenue, pickup_date, pickup_time, delivery_date, delivery_time,
              customer_name, customer_ref, driver_name, dispatcher_name, vendor_name, vendor_dispatch,
              load_number, target_buy, max_buy, spot_bid, fuel_surcharge, docs_scanned, invoice_date,
              invoice_audit, purch_tr, net_mrg, cm, nbr_of_stops, stops,
              published, archived, created_at, updated_at
            ) VALUES (
              ${load.rr_number}, ${load.tm_number || null}, ${load.status_code || null}, 
              ${load.origin_city}, ${load.origin_state}, ${load.destination_city}, ${load.destination_state},
              ${load.equipment}, ${load.weight || null}, ${load.miles || 0}, ${load.revenue || 0}, 
              ${pickupDate}, ${load.pickup_time || null}, ${deliveryDate}, ${load.delivery_time || null},
              ${load.customer_name || null}, ${load.customer_ref || null},
              ${load.driver_name || null}, ${load.dispatcher_name || null}, ${load.vendor_name || null}, ${load.vendor_dispatch || null},
              ${load.load_number || null}, ${load.target_buy || null}, ${load.max_buy || null}, ${load.spot_bid || null},
              ${load.fuel_surcharge || 0}, ${load.docs_scanned || null}, ${load.invoice_date || null},
              ${load.invoice_audit || null}, ${load.purch_tr || null}, ${load.net_mrg || null}, ${load.cm || null},
              ${load.nbr_of_stops || null}, ${load.stops || null},
              true, false, NOW(), NOW()
            )
            ON CONFLICT (rr_number) 
            DO UPDATE SET
              tm_number = EXCLUDED.tm_number,
              status_code = EXCLUDED.status_code,
              origin_city = EXCLUDED.origin_city,
              origin_state = EXCLUDED.origin_state,
              destination_city = EXCLUDED.destination_city,
              destination_state = EXCLUDED.destination_state,
              equipment = EXCLUDED.equipment,
              weight = EXCLUDED.weight,
              miles = EXCLUDED.miles,
              revenue = EXCLUDED.revenue,
              pickup_date = EXCLUDED.pickup_date,
              pickup_time = EXCLUDED.pickup_time,
              delivery_date = EXCLUDED.delivery_date,
              delivery_time = EXCLUDED.delivery_time,
              customer_name = EXCLUDED.customer_name,
              customer_ref = EXCLUDED.customer_ref,
              driver_name = EXCLUDED.driver_name,
              dispatcher_name = EXCLUDED.dispatcher_name,
              vendor_name = EXCLUDED.vendor_name,
              vendor_dispatch = EXCLUDED.vendor_dispatch,
              load_number = EXCLUDED.load_number,
              target_buy = EXCLUDED.target_buy,
              max_buy = EXCLUDED.max_buy,
              spot_bid = EXCLUDED.spot_bid,
              fuel_surcharge = EXCLUDED.fuel_surcharge,
              docs_scanned = EXCLUDED.docs_scanned,
              invoice_date = EXCLUDED.invoice_date,
              invoice_audit = EXCLUDED.invoice_audit,
              purch_tr = EXCLUDED.purch_tr,
              net_mrg = EXCLUDED.net_mrg,
              cm = EXCLUDED.cm,
              nbr_of_stops = EXCLUDED.nbr_of_stops,
              stops = EXCLUDED.stops,
              published = EXCLUDED.published,
              updated_at = NOW()
          `;
          mergedCount++;
        } catch (mergeError) {
          console.error("Error merging load:", load.rr_number, mergeError);
        }
      }
      
      console.log(`Successfully merged ${mergedCount} loads to main loads table`);

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${parsedLoads.length} loads from ${file.name.endsWith('.csv') ? 'CSV' : 'Excel'} file`,
        data: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.name.endsWith('.csv') ? 'CSV' : 'Excel',
          summary: summary,
          validation: {
            total_loads: parsedLoads.length,
            valid_loads: validLoads.length,
            invalid_loads: invalidLoads.length,
            invalid_loads_details: invalidLoads.slice(0, 10).map(result => ({
              rr_number: result.load.rr_number,
              errors: result.errors
            }))
          },
          loads_created: mergedCount
        }
      });

    } catch (dbError) {
      console.error("Database error during Excel processing:", dbError);
      return NextResponse.json(
        { 
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
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to process Excel file",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}