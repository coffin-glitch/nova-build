import { NextRequest, NextResponse } from "next/server";
import { roleManager } from "@/lib/role-manager";
import sql from "@/lib/db.server";
import * as XLSX from "xlsx";
import { parseEAXCSV, parseEAXExcel, validateEAXLoad, getLoadSummary, EAXLoadData } from "@/lib/eax-parser";

export async function POST(request: NextRequest) {
  try {
    // TODO: Add proper admin authentication here
    // For now, we'll trust that the client-side admin check is sufficient
    // In production, you should verify the JWT token or use session-based auth

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
      const csvText = new TextDecoder().decode(buffer);
      parsedLoads = parseEAXCSV(csvText);
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
              const parsed = load.pickup_date instanceof Date ? load.pickup_date : new Date(load.pickup_date);
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
              const parsed = load.delivery_date instanceof Date ? load.delivery_date : new Date(load.delivery_date);
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
              rr_number, tm_number, status_code, pickup_date, pickup_window, delivery_date, delivery_window,
              revenue, purchase, net, margin, equipment, customer_name, customer_ref, driver_name,
              total_miles, origin_city, origin_state, destination_city, destination_state,
              vendor_name, dispatcher_name, created_at
            ) VALUES (
              ${load.rr_number}, ${load.tm_number || null}, ${load.status_code || null}, 
              ${pickupDate}, ${load.pickup_window || null}, 
              ${deliveryDate}, ${load.delivery_window || null},
              ${load.revenue || null}, ${load.purchase || null}, ${load.net || null}, ${load.margin || null}, 
              ${load.equipment || null}, ${load.customer_name || null}, ${load.customer_ref || null}, ${load.driver_name || null},
              ${load.miles || null}, ${load.origin_city || null}, ${load.origin_state || null}, 
              ${load.destination_city || null}, ${load.destination_state || null},
              ${load.vendor_name || null}, ${load.dispatcher_name || null}, NOW()
            )`;
        } catch (insertError) {
          console.error("Error inserting load:", load.rr_number, insertError);
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
              const parsed = load.pickup_date instanceof Date ? load.pickup_date : new Date(load.pickup_date);
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
              const parsed = load.delivery_date instanceof Date ? load.delivery_date : new Date(load.delivery_date);
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
              equipment, miles, revenue, pickup_date, delivery_date,
              customer_name, customer_ref, driver_name, dispatcher_name, vendor_name,
              published, archived, created_at, updated_at
            ) VALUES (
              ${load.rr_number}, ${load.tm_number || null}, ${load.status_code || null}, 
              ${load.origin_city}, ${load.origin_state}, ${load.destination_city}, ${load.destination_state},
              ${load.equipment}, ${load.miles || 0}, ${load.revenue || 0}, 
              ${pickupDate}, ${deliveryDate},
              ${load.customer_name || null}, ${load.customer_ref || null},
              ${load.driver_name || null}, ${load.dispatcher_name || null}, ${load.vendor_name || null},
              false, false, NOW(), NOW()
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
              miles = EXCLUDED.miles,
              revenue = EXCLUDED.revenue,
              pickup_date = EXCLUDED.pickup_date,
              delivery_date = EXCLUDED.delivery_date,
              customer_name = EXCLUDED.customer_name,
              customer_ref = EXCLUDED.customer_ref,
              driver_name = EXCLUDED.driver_name,
              dispatcher_name = EXCLUDED.dispatcher_name,
              vendor_name = EXCLUDED.vendor_name,
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