"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import sql from "./db.server";
import { requireAdmin } from "./auth";

// Get all loads with pagination and filtering
export async function getLoads(params: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
} = {}) {
  await requireAdmin();
  
  const { limit = 50, offset = 0, search = "", status = "" } = params;
  
  try {
    let query = sql`
      SELECT 
        rr_number,
        tm_number,
        status_code,
        pickup_date,
        pickup_window,
        delivery_date,
        delivery_window,
        revenue,
        purchase,
        net,
        margin,
        equipment,
        customer_name,
        driver_name,
        total_miles,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        vendor_name,
        dispatcher_name,
        updated_at,
        published,
        archived
      FROM loads
      WHERE archived = FALSE
    `;
    
    // Add search filter
    if (search) {
      query = sql`
        ${query}
        AND (
          rr_number ILIKE ${`%${search}%`} OR
          customer_name ILIKE ${`%${search}%`} OR
          origin_city ILIKE ${`%${search}%`} OR
          destination_city ILIKE ${`%${search}%`}
        )
      `;
    }
    
    // Add status filter
    if (status) {
      query = sql`
        ${query}
        AND status_code = ${status}
      `;
    }
    
    // Add ordering and pagination
    query = sql`
      ${query}
      ORDER BY updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const loads = await query;
    return { success: true, data: loads };
  } catch (error) {
    console.error("Error fetching loads:", error);
    return { success: false, error: "Failed to fetch loads" };
  }
}

// Get load statistics
export async function getLoadStats() {
  await requireAdmin();
  
  try {
    const [totalLoads, activeLoads, archivedLoads] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM loads`,
      sql`SELECT COUNT(*) as count FROM loads WHERE archived = FALSE`,
      sql`SELECT COUNT(*) as count FROM loads WHERE archived = TRUE`
    ]);
    
    return {
      success: true,
      data: {
        total: totalLoads[0]?.count || 0,
        active: activeLoads[0]?.count || 0,
        archived: archivedLoads[0]?.count || 0
      }
    };
  } catch (error) {
    console.error("Error fetching load stats:", error);
    return { success: false, error: "Failed to fetch load statistics" };
  }
}

// Delete a single load
export async function deleteLoad(rrNumber: string) {
  await requireAdmin();
  
  try {
    await sql`DELETE FROM loads WHERE rr_number = ${rrNumber}`;
    return { success: true };
  } catch (error) {
    console.error("Error deleting load:", error);
    return { success: false, error: "Failed to delete load" };
  }
}

// Bulk delete loads
export async function bulkDeleteLoads(rrNumbers: string[]) {
  await requireAdmin();
  
  try {
    await sql`DELETE FROM loads WHERE rr_number = ANY(${rrNumbers})`;
    return { success: true, deleted: rrNumbers.length };
  } catch (error) {
    console.error("Error bulk deleting loads:", error);
    return { success: false, error: "Failed to delete loads" };
  }
}

// Update load status
export async function updateLoadStatus(rrNumber: string, status: string) {
  await requireAdmin();
  
  try {
    await sql`
      UPDATE loads 
      SET status_code = ${status}, updated_at = NOW() 
      WHERE rr_number = ${rrNumber}
    `;
    return { success: true };
  } catch (error) {
    console.error("Error updating load status:", error);
    return { success: false, error: "Failed to update load status" };
  }
}

// Bulk update load status
export async function bulkUpdateLoadStatus(rrNumbers: string[], status: string) {
  await requireAdmin();
  
  try {
    await sql`
      UPDATE loads 
      SET status_code = ${status}, updated_at = NOW() 
      WHERE rr_number = ANY(${rrNumbers})
    `;
    return { success: true, updated: rrNumbers.length };
  } catch (error) {
    console.error("Error bulk updating load status:", error);
    return { success: false, error: "Failed to update load statuses" };
  }
}

// Archive a load
export async function archiveLoad(rrNumber: string) {
  await requireAdmin();
  
  try {
    await sql`
      UPDATE loads 
      SET archived = TRUE, updated_at = NOW() 
      WHERE rr_number = ${rrNumber}
    `;
    return { success: true };
  } catch (error) {
    console.error("Error archiving load:", error);
    return { success: false, error: "Failed to archive load" };
  }
}

// Bulk archive loads
export async function bulkArchiveLoads(rrNumbers: string[]) {
  await requireAdmin();
  
  try {
    await sql`
      UPDATE loads 
      SET archived = TRUE, updated_at = NOW() 
      WHERE rr_number = ANY(${rrNumbers})
    `;
    return { success: true, archived: rrNumbers.length };
  } catch (error) {
    console.error("Error bulk archiving loads:", error);
    return { success: false, error: "Failed to archive loads" };
  }
}

// Clear all loads (admin only)
export async function clearAllLoads() {
  await requireAdmin();
  
  try {
    await sql`DELETE FROM loads`;
    return { success: true };
  } catch (error) {
    console.error("Error clearing all loads:", error);
    return { success: false, error: "Failed to clear all loads" };
  }
}