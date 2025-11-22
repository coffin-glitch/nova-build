import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

/**
 * DNU List Upload API
 * Processes Excel/CSV files containing USPS DNU list
 * Updates database with new entries and marks removed entries
 */

interface DNURow {
  mc_number?: string;
  dot_number?: string;
  carrier_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      logSecurityEvent('dnu_upload_no_file', adminUserId);
      const response = NextResponse.json(
        { ok: false, error: "No file provided" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate file size (max 50MB for large DNU lists)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      logSecurityEvent('dnu_upload_size_exceeded', adminUserId, { 
        fileName: file.name,
        fileSize: file.size,
        maxSize
      });
      const response = NextResponse.json(
        { ok: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      logSecurityEvent('dnu_upload_invalid_type', adminUserId, { 
        fileName: file.name,
        fileType: file.type
      });
      const response = NextResponse.json(
        { ok: false, error: "Only Excel (.xlsx, .xls) and CSV (.csv) files are supported" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    console.log(`DNU Upload: Processing file "${file.name}"`);

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const uploadDate = new Date();

    let dnuEntries: DNURow[] = [];

    if (file.name.endsWith('.csv')) {
      // Parse CSV file
      const csvText = new TextDecoder().decode(buffer);
      dnuEntries = parseDNUCSV(csvText);
    } else {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      dnuEntries = parseDNUExcel(jsonData as any[][]);
    }

    console.log(`DNU Upload: Parsed ${dnuEntries.length} entries from file`);

    if (dnuEntries.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid DNU entries found in file" },
        { status: 400 }
      );
    }

    // Log sample of parsed entries for debugging
    console.log(`DNU Upload: Sample entries (first 5):`, dnuEntries.slice(0, 5));
    const entriesWithMC = dnuEntries.filter(e => e.mc_number).length;
    const entriesWithDOT = dnuEntries.filter(e => e.dot_number).length;
    const entriesWithBoth = dnuEntries.filter(e => e.mc_number && e.dot_number).length;
    console.log(`DNU Upload: Entries with MC: ${entriesWithMC}, with DOT: ${entriesWithDOT}, with both: ${entriesWithBoth}`);

    // Get all existing DNU entries
    const existingEntries = await sql`
      SELECT mc_number, dot_number, status
      FROM dnu_tracking
    `;

    const existingMap = new Map<string, { mc?: string; dot?: string; status: string }>();
    existingEntries.forEach((entry: any) => {
      const key = `${entry.mc_number || ''}_${entry.dot_number || ''}`;
      existingMap.set(key, {
        mc: entry.mc_number,
        dot: entry.dot_number,
        status: entry.status
      });
    });

    // Create map of new entries
    const newEntriesMap = new Map<string, DNURow>();
    dnuEntries.forEach(entry => {
      const key = `${entry.mc_number || ''}_${entry.dot_number || ''}`;
      newEntriesMap.set(key, entry);
    });

    // Track changes
    let addedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;

    // Process new entries (add or update)
    // Use ON CONFLICT to handle duplicates efficiently
    for (const entry of dnuEntries) {
      const key = `${entry.mc_number || ''}_${entry.dot_number || ''}`;
      const existing = existingMap.get(key);

      if (!existing) {
        // New entry - add to DNU (use ON CONFLICT to handle duplicates)
        try {
          await sql`
            INSERT INTO dnu_tracking (
              mc_number,
              dot_number,
              carrier_name,
              status,
              added_to_dnu_at,
              last_upload_date
            ) VALUES (
              ${entry.mc_number || null},
              ${entry.dot_number || null},
              ${entry.carrier_name || null},
              'active',
              ${uploadDate},
              ${uploadDate}
            )
            ON CONFLICT (mc_number, dot_number) DO UPDATE SET
              status = 'active',
              added_to_dnu_at = CASE 
                WHEN dnu_tracking.status = 'removed' THEN ${uploadDate}
                ELSE dnu_tracking.added_to_dnu_at
              END,
              removed_from_dnu_at = NULL,
              last_upload_date = ${uploadDate},
              carrier_name = COALESCE(EXCLUDED.carrier_name, dnu_tracking.carrier_name)
          `;
          addedCount++;
        } catch (error: any) {
          console.error(`Error inserting DNU entry ${key}:`, error.message);
          // If ON CONFLICT didn't work, try direct update
          const updateResult = await sql`
            UPDATE dnu_tracking
            SET 
              status = 'active',
              added_to_dnu_at = CASE 
                WHEN status = 'removed' THEN ${uploadDate}
                ELSE added_to_dnu_at
              END,
              removed_from_dnu_at = NULL,
              last_upload_date = ${uploadDate},
              carrier_name = COALESCE(${entry.carrier_name || null}, carrier_name)
            WHERE 
              COALESCE(mc_number::text, '') = COALESCE(${entry.mc_number || null}::text, '')
              AND COALESCE(dot_number::text, '') = COALESCE(${entry.dot_number || null}::text, '')
          `;
          if (updateResult.count > 0) {
            updatedCount++;
          } else {
            console.warn(`DNU Upload: Failed to insert or update entry: ${key}`);
          }
        }
      } else if (existing.status === 'removed') {
        // Was removed, now back on list - reactivate
        const updateResult = await sql`
          UPDATE dnu_tracking
          SET 
            status = 'active',
            added_to_dnu_at = ${uploadDate},
            removed_from_dnu_at = NULL,
            last_upload_date = ${uploadDate},
            carrier_name = COALESCE(${entry.carrier_name || null}, carrier_name)
          WHERE 
            COALESCE(mc_number::text, '') = COALESCE(${entry.mc_number || null}::text, '')
            AND COALESCE(dot_number::text, '') = COALESCE(${entry.dot_number || null}::text, '')
        `;
        if (updateResult.count > 0) {
          updatedCount++;
        }
      } else {
        // Already exists and active - just update last_upload_date and carrier_name
        const updateResult = await sql`
          UPDATE dnu_tracking
          SET 
            last_upload_date = ${uploadDate},
            carrier_name = COALESCE(${entry.carrier_name || null}, carrier_name)
          WHERE 
            COALESCE(mc_number::text, '') = COALESCE(${entry.mc_number || null}::text, '')
            AND COALESCE(dot_number::text, '') = COALESCE(${entry.dot_number || null}::text, '')
        `;
        if (updateResult.count > 0) {
          updatedCount++;
        }
      }
    }

    // Mark entries as removed if they're not in the new list
    for (const [key, existing] of existingMap.entries()) {
      if (!newEntriesMap.has(key) && existing.status === 'active') {
        // Was active, now not in new list - mark as removed
        await sql`
          UPDATE dnu_tracking
          SET 
            status = 'removed',
            removed_from_dnu_at = ${uploadDate},
            last_upload_date = ${uploadDate}
          WHERE 
            COALESCE(mc_number::text, '') = COALESCE(${existing.mc || null}::text, '')
            AND COALESCE(dot_number::text, '') = COALESCE(${existing.dot || null}::text, '')
        `;
        removedCount++;
      }
    }

    console.log(`DNU Upload: Added: ${addedCount}, Updated: ${updatedCount}, Removed: ${removedCount}`);

    // Verify final count in database
    const finalCount = await sql`
      SELECT COUNT(*)::int as count
      FROM dnu_tracking
      WHERE status = 'active'
    `;
    const totalInDb = await sql`
      SELECT COUNT(*)::int as count
      FROM dnu_tracking
    `;

    console.log(`DNU Upload: Final counts - Active: ${finalCount[0]?.count || 0}, Total in DB: ${totalInDb[0]?.count || 0}`);

    logSecurityEvent('dnu_upload_success', adminUserId, {
      fileName: file.name,
      fileSize: file.size,
      totalEntries: dnuEntries.length,
      added: addedCount,
      updated: updatedCount,
      removed: removedCount
    });

    const response = NextResponse.json({
      ok: true,
      message: `DNU list updated successfully`,
      data: {
        total_entries: dnuEntries.length,
        added: addedCount,
        updated: updatedCount,
        removed: removedCount,
        active_in_db: finalCount[0]?.count || 0,
        total_in_db: totalInDb[0]?.count || 0,
        upload_date: uploadDate.toISOString()
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error processing DNU upload:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('dnu_upload_error', adminUserId, { 
      error: error instanceof Error ? error.message : String(error),
      fileName: file?.name
    });
    
    const response = NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Failed to process DNU upload",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

/**
 * Parse DNU CSV file
 */
function parseDNUCSV(csvText: string): DNURow[] {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length < 2) {
    throw new Error("CSV file appears to be empty or has no data rows");
  }

  // Try to detect headers
  const headerLine = lines[0].toLowerCase();
  let mcIndex = -1;
  let dotIndex = -1;
  let carrierNameIndex = -1;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  // Find MC column (look for "mc", "mc#", "mc number", etc.)
  mcIndex = headers.findIndex(h => 
    h.includes('mc') && !h.includes('dot')
  );
  
  // Find DOT column (look for "dot", "dot#", "dot number", etc.)
  dotIndex = headers.findIndex(h => 
    h.includes('dot')
  );

  // Find carrier name column (may be empty header, look for first non-MC/DOT column or empty header)
  carrierNameIndex = headers.findIndex((h, idx) => 
    idx !== mcIndex && idx !== dotIndex && (h === '' || h.includes('name') || h.includes('carrier'))
  );

  console.log(`DNU CSV: MC index: ${mcIndex}, DOT index: ${dotIndex}, Carrier name index: ${carrierNameIndex}`);

  const entries: DNURow[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    const mc = mcIndex >= 0 && values[mcIndex] ? cleanMCNumber(values[mcIndex]) : undefined;
    const dot = dotIndex >= 0 && values[dotIndex] ? cleanDOTNumber(values[dotIndex]) : undefined;
    const carrierName = carrierNameIndex >= 0 && values[carrierNameIndex] ? values[carrierNameIndex] : undefined;

    // Skip rows with no MC or DOT
    if (!mc && !dot) {
      continue;
    }

    entries.push({
      mc_number: mc,
      dot_number: dot,
      carrier_name: carrierName
    });
  }

  return entries;
}

/**
 * Parse DNU Excel file
 */
function parseDNUExcel(jsonData: any[][]): DNURow[] {
  if (jsonData.length < 2) {
    throw new Error("Excel file appears to be empty or has no data rows");
  }

  const headers = (jsonData[0] as string[]).map(h => h ? String(h).trim().toLowerCase() : '');
  
  let mcIndex = -1;
  let dotIndex = -1;
  let carrierNameIndex = -1;

  // Find MC column - look for "mc number", "mc#", "mc", etc.
  mcIndex = headers.findIndex(h => 
    h && (h.includes('mc') || h.includes('motor carrier')) && !h.includes('dot')
  );

  // Find DOT column - look for "dot number", "dot#", "dot", etc.
  dotIndex = headers.findIndex(h => 
    h && (h.includes('dot') || h.includes('department of transportation'))
  );

  // Find carrier name column - first column that's not MC or DOT
  // Often it's the first column with an empty/null header
  carrierNameIndex = headers.findIndex((h, idx) => 
    idx !== mcIndex && idx !== dotIndex && (!h || h === '' || h.includes('name') || h.includes('carrier') || h.includes('company'))
  );

  // If still not found, use first column that's not MC or DOT
  if (carrierNameIndex === -1) {
    for (let i = 0; i < headers.length; i++) {
      if (i !== mcIndex && i !== dotIndex) {
        carrierNameIndex = i;
        break;
      }
    }
  }

  console.log(`DNU Excel: Headers:`, headers);
  console.log(`DNU Excel: MC index: ${mcIndex}, DOT index: ${dotIndex}, Carrier name index: ${carrierNameIndex}`);
  console.log(`DNU Excel: Total rows in file: ${jsonData.length} (${jsonData.length - 1} data rows)`);

  const entries: DNURow[] = [];
  const dataRows = jsonData.slice(1) as any[][];
  let skippedRows = 0;
  let skippedReasons: { noMcNoDot: number; emptyRow: number } = { noMcNoDot: 0, emptyRow: 0 };

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    
    // Skip completely empty rows
    if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      skippedReasons.emptyRow++;
      continue;
    }

    // Extract values, handling both numbers and strings
    const mcValue = mcIndex >= 0 && row[mcIndex] !== null && row[mcIndex] !== undefined 
      ? String(row[mcIndex]).trim() 
      : '';
    const dotValue = dotIndex >= 0 && row[dotIndex] !== null && row[dotIndex] !== undefined 
      ? String(row[dotIndex]).trim() 
      : '';
    const carrierNameValue = carrierNameIndex >= 0 && row[carrierNameIndex] !== null && row[carrierNameIndex] !== undefined
      ? String(row[carrierNameIndex]).trim()
      : '';

    // Clean MC and DOT numbers
    const mc = mcValue ? cleanMCNumber(mcValue) : undefined;
    const dot = dotValue ? cleanDOTNumber(dotValue) : undefined;
    const carrierName = carrierNameValue || undefined;

    // Skip rows with no MC or DOT (at least one is required)
    if (!mc && !dot) {
      skippedRows++;
      skippedReasons.noMcNoDot++;
      if (rowIdx < 10) {
        console.log(`DNU Excel: Skipping row ${rowIdx + 2} (no MC or DOT):`, { mcValue, dotValue, carrierNameValue });
      }
      continue;
    }

    entries.push({
      mc_number: mc,
      dot_number: dot,
      carrier_name: carrierName
    });
  }

  console.log(`DNU Excel: Parsed ${entries.length} entries, skipped ${skippedRows} rows (${skippedReasons.noMcNoDot} no MC/DOT, ${skippedReasons.emptyRow} empty)`);

  return entries;
}

/**
 * Clean and normalize MC number
 */
function cleanMCNumber(mc: string): string | undefined {
  if (!mc) return undefined;
  // Remove non-numeric characters and extract just the number
  const cleaned = mc.replace(/\D/g, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Clean and normalize DOT number
 */
function cleanDOTNumber(dot: string): string | undefined {
  if (!dot) return undefined;
  // Remove non-numeric characters and extract just the number
  const cleaned = dot.replace(/\D/g, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

