import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * MC Access Control API
 * GET: Get all MC access control states
 * POST: Create or update MC access control state
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const mcNumber = searchParams.get('mc');
    
    if (mcNumber) {
      // Get specific MC
      const result = await sql`
        SELECT 
          id,
          mc_number,
          is_active,
          disabled_reason,
          disabled_by,
          disabled_at,
          enabled_by,
          enabled_at,
          created_at,
          updated_at
        FROM mc_access_control
        WHERE mc_number = ${mcNumber}
        LIMIT 1
      `;
      
      if (result.length === 0) {
        // MC not in table = active by default
        return NextResponse.json({
          ok: true,
          data: {
            mc_number: mcNumber,
            is_active: true,
            disabled_reason: null,
            disabled_by: null,
            disabled_at: null,
            enabled_by: null,
            enabled_at: null,
          }
        });
      }
      
      return NextResponse.json({
        ok: true,
        data: result[0]
      });
    } else {
      // Get ALL unique MC numbers from carrier_profiles with their carrier counts
      // This ensures all MCs are visible in Main Control, even if they're active by default
      const allMcNumbersWithCounts = await sql`
        SELECT 
          mc_number,
          COUNT(*)::int as carrier_count
        FROM carrier_profiles
        WHERE mc_number IS NOT NULL AND mc_number != ''
        GROUP BY mc_number
        ORDER BY mc_number ASC
      `;
      
      // Get access control states for MCs that have entries
      const accessControls = await sql`
        SELECT 
          id,
          mc_number,
          is_active,
          disabled_reason,
          disabled_by,
          disabled_at,
          enabled_by,
          enabled_at,
          created_at,
          updated_at
        FROM mc_access_control
      `;
      
      // Create a map of MC number to access control state
      const accessControlMap = new Map();
      accessControls.forEach((ac: any) => {
        accessControlMap.set(ac.mc_number, ac);
      });
      
      // Build result array with all MCs
      const result = allMcNumbersWithCounts.map((row: any) => {
        const mcNumber = row.mc_number;
        const carrierCount = row.carrier_count || 0;
        const accessControl = accessControlMap.get(mcNumber);
        
        // If MC has an access control entry, use it
        if (accessControl) {
          return {
            ...accessControl,
            carrier_count: carrierCount
          };
        }
        
        // If MC is not in table, it's active by default
        return {
          id: null,
          mc_number: mcNumber,
          is_active: true, // Active by default
          disabled_reason: null,
          disabled_by: null,
          disabled_at: null,
          enabled_by: null,
          enabled_at: null,
          created_at: null,
          updated_at: null,
          carrier_count: carrierCount
        };
      });
      
      // Sort: disabled first, then by updated_at desc, then by mc_number
      result.sort((a: any, b: any) => {
        // Disabled MCs first
        if (a.is_active !== b.is_active) {
          return a.is_active ? 1 : -1;
        }
        // Then by updated_at (most recent first)
        if (a.updated_at && b.updated_at) {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        if (a.updated_at) return -1;
        if (b.updated_at) return 1;
        // Finally by MC number
        return a.mc_number.localeCompare(b.mc_number);
      });
      
      return NextResponse.json({
        ok: true,
        data: result
      });
    }
  } catch (error: any) {
    console.error("Error getting MC access control:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to get MC access control" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;
    
    const { mc_number, is_active, disabled_reason } = await request.json();
    
    if (!mc_number) {
      return NextResponse.json(
        { ok: false, error: "MC number is required" },
        { status: 400 }
      );
    }
    
    // Check if MC access control already exists
    const existing = await sql`
      SELECT id, is_active
      FROM mc_access_control
      WHERE mc_number = ${mc_number}
      LIMIT 1
    `;
    
    if (existing.length > 0) {
      // Update existing
      const wasActive = existing[0].is_active;
      
      await sql`
        UPDATE mc_access_control
        SET 
          is_active = ${is_active},
          disabled_reason = ${is_active ? null : (disabled_reason || 'DNU by USPS')},
          disabled_by = ${is_active ? null : adminUserId},
          disabled_at = ${is_active ? null : new Date()},
          enabled_by = ${is_active ? adminUserId : null},
          enabled_at = ${is_active ? new Date() : null},
          updated_at = NOW()
        WHERE mc_number = ${mc_number}
      `;
      
      // The trigger will automatically update carrier profiles
      
      return NextResponse.json({
        ok: true,
        message: `MC ${mc_number} ${is_active ? 'enabled' : 'disabled'} successfully`,
        data: {
          mc_number,
          is_active,
          was_active: wasActive
        }
      });
    } else {
      // Create new (only if disabling - active MCs don't need entries)
      if (!is_active) {
        await sql`
          INSERT INTO mc_access_control (
            mc_number,
            is_active,
            disabled_reason,
            disabled_by,
            disabled_at
          ) VALUES (
            ${mc_number},
            ${is_active},
            ${disabled_reason || 'DNU by USPS'},
            ${adminUserId},
            NOW()
          )
        `;
        
        // The trigger will automatically update carrier profiles
        
        return NextResponse.json({
          ok: true,
          message: `MC ${mc_number} disabled successfully`,
          data: {
            mc_number,
            is_active: false
          }
        });
      } else {
        // MC is active but not in table - that's fine, it's active by default
        return NextResponse.json({
          ok: true,
          message: `MC ${mc_number} is active`,
          data: {
            mc_number,
            is_active: true
          }
        });
      }
    }
  } catch (error: any) {
    console.error("Error updating MC access control:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update MC access control" },
      { status: 500 }
    );
  }
}

