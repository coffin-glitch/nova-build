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
      // Get all MCs with their access states
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
          updated_at,
          (
            SELECT COUNT(*)
            FROM carrier_profiles
            WHERE carrier_profiles.mc_number = mc_access_control.mc_number
          ) as carrier_count
        FROM mc_access_control
        ORDER BY 
          is_active DESC,
          updated_at DESC,
          mc_number ASC
      `;
      
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

