import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: "Only Excel files (.xlsx, .xls) are supported" },
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
        { error: "Excel file appears to be empty or has no data rows" },
        { status: 400 }
      );
    }

    // TODO: Implement proper EAX Excel parsing logic
    // This is a mock parser - replace with actual EAX format parsing
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as any[][];
    
    console.log("Excel headers:", headers);
    console.log("Data rows count:", dataRows.length);
    console.log("Sample row:", dataRows[0]);

    // Mock parsing - replace with actual EAX format mapping
    const parsedLoads = dataRows.map((row, index) => {
      // TODO: Map Excel columns to EAX load format
      // This is a placeholder structure
      return {
        // Example mapping - adjust based on actual EAX Excel format
        load_id: row[0] || `MOCK_${Date.now()}_${index}`,
        origin: row[1] || "Unknown Origin",
        destination: row[2] || "Unknown Destination", 
        pickup_date: row[3] || new Date().toISOString(),
        delivery_date: row[4] || new Date().toISOString(),
        rate: row[5] ? parseFloat(row[5]) : 0,
        miles: row[6] ? parseInt(row[6]) : 0,
        equipment_type: row[7] || "Dry Van",
        weight: row[8] ? parseFloat(row[8]) : 0,
        commodity: row[9] || "General Freight",
        notes: row[10] || "",
        // Add more fields as needed based on EAX format
      };
    });

    console.log("Parsed loads sample:", parsedLoads[0]);

    // Insert into eax_loads_raw table
    try {
      for (const load of parsedLoads) {
        await sql`
          INSERT INTO eax_loads_raw (
            load_id, origin, destination, pickup_date, delivery_date, 
            rate, miles, equipment_type, weight, commodity, notes, 
            raw_data, created_at, updated_at
          ) VALUES (
            ${load.load_id}, ${load.origin}, ${load.destination}, 
            ${load.pickup_date}, ${load.delivery_date}, ${load.rate}, 
            ${load.miles}, ${load.equipment_type}, ${load.weight}, 
            ${load.commodity}, ${load.notes}, ${JSON.stringify(load)}, NOW(), NOW()
          )
          ON CONFLICT (load_id) DO UPDATE SET
            origin = EXCLUDED.origin,
            destination = EXCLUDED.destination,
            pickup_date = EXCLUDED.pickup_date,
            delivery_date = EXCLUDED.delivery_date,
            rate = EXCLUDED.rate,
            miles = EXCLUDED.miles,
            equipment_type = EXCLUDED.equipment_type,
            weight = EXCLUDED.weight,
            commodity = EXCLUDED.commodity,
            notes = EXCLUDED.notes,
            raw_data = EXCLUDED.raw_data,
            updated_at = NOW()
        `;
      }

      // Merge from eax_loads_raw to loads table
      await sql`
        INSERT INTO loads (
          load_id, origin, destination, pickup_date, delivery_date,
          rate, miles, equipment_type, weight, commodity, notes,
          published, created_at, updated_at
        )
        SELECT 
          load_id, origin, destination, pickup_date, delivery_date,
          rate, miles, equipment_type, weight, commodity, notes,
          false as published, NOW() as created_at, NOW() as updated_at
        FROM eax_loads_raw
        WHERE load_id = ANY(${parsedLoads.map(l => l.load_id)})
        ON CONFLICT (load_id) DO UPDATE SET
          origin = EXCLUDED.origin,
          destination = EXCLUDED.destination,
          pickup_date = EXCLUDED.pickup_date,
          delivery_date = EXCLUDED.delivery_date,
          rate = EXCLUDED.rate,
          miles = EXCLUDED.miles,
          equipment_type = EXCLUDED.equipment_type,
          weight = EXCLUDED.weight,
          commodity = EXCLUDED.commodity,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `;

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${parsedLoads.length} loads from Excel file`,
        data: {
          file_name: file.name,
          file_size: file.size,
          rows_processed: parsedLoads.length,
          loads_created: parsedLoads.length
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