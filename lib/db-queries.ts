/**
 * Database Query Helpers - DEPRECATED (Supabase-Only Migration)
 * 
 * ⚠️ This file is deprecated. All routes should now use direct `supabase_user_id = ${userId}` queries.
 * 
 * These helpers were used for dual-auth support (Clerk + Supabase) but are no longer needed
 * since we've migrated to Supabase-only authentication.
 * 
 * For new code, use: `WHERE supabase_user_id = ${userId}` directly.
 * 
 * This file is kept temporarily for backwards compatibility but will be removed in a future update.
 */

import type { Sql } from "postgres";
import sql from "./db";

/**
 * DEPRECATED: Use direct `WHERE supabase_user_id = ${userId}` queries instead
 */
export async function getUserWhereCondition(
  userId: string,
  provider: 'supabase', // Only 'supabase' is supported now
  columnPrefix: string = ''
): Promise<Sql<Record<string, unknown>>> {
  if (columnPrefix) {
    return sql.unsafe(`${columnPrefix}.supabase_user_id = $1`, [userId]) as unknown as Sql<Record<string, unknown>>;
  } else {
    return sql`supabase_user_id = ${userId}` as unknown as Sql<Record<string, unknown>>;
  }
}

/**
 * DEPRECATED: Use direct `WHERE supabase_carrier_user_id = ${userId}` queries instead
 */
export async function getCarrierUserWhereCondition(
  userId: string,
  provider: 'supabase', // Only 'supabase' is supported now
  columnPrefix: string = ''
): Promise<Sql<Record<string, unknown>>> {
  if (columnPrefix) {
    return sql.unsafe(`${columnPrefix}.supabase_carrier_user_id = $1`, [userId]) as unknown as Sql<Record<string, unknown>>;
  } else {
    return sql`supabase_carrier_user_id = ${userId}` as unknown as Sql<Record<string, unknown>>;
  }
}

/**
 * DEPRECATED: Use direct `WHERE supabase_admin_user_id = ${userId}` queries instead
 */
export async function getAdminUserWhereCondition(
  userId: string,
  provider: 'supabase', // Only 'supabase' is supported now
  columnPrefix: string = ''
): Promise<Sql<Record<string, unknown>>> {
  if (columnPrefix) {
    return sql.unsafe(`${columnPrefix}.supabase_admin_user_id = $1`, [userId]) as unknown as Sql<Record<string, unknown>>;
  } else {
    return sql`supabase_admin_user_id = ${userId}` as unknown as Sql<Record<string, unknown>>;
  }
}

/**
 * DEPRECATED: Use direct `WHERE supabase_winner_user_id = ${userId}` queries instead
 */
export async function getWinnerUserWhereCondition(
  userId: string,
  provider: 'supabase', // Only 'supabase' is supported now
  columnPrefix: string = ''
): Promise<Sql<Record<string, unknown>>> {
  if (columnPrefix) {
    return sql.unsafe(`${columnPrefix}.winner_user_id = $1`, [userId]) as unknown as Sql<Record<string, unknown>>;
  } else {
    return sql`winner_user_id = ${userId}` as unknown as Sql<Record<string, unknown>>;
  }
}

/**
 * DEPRECATED: Use direct `WHERE supabase_sender_id = ${userId}` queries instead
 */
export async function getSenderUserWhereCondition(
  userId: string,
  provider: 'supabase', // Only 'supabase' is supported now
  columnPrefix: string = ''
): Promise<Sql<Record<string, unknown>>> {
  if (columnPrefix) {
    return sql.unsafe(`${columnPrefix}.supabase_sender_id = $1`, [userId]) as unknown as Sql<Record<string, unknown>>;
  } else {
    return sql`supabase_sender_id = ${userId}` as unknown as Sql<Record<string, unknown>>;
  }
}

/**
 * DEPRECATED: This function is no longer needed with Supabase-only auth
 */
export async function getCurrentUserIds(): Promise<{
  userId: string;
  provider: 'supabase';
  supabaseUserId: string;
}> {
  // In Supabase-only setup, just return the userId
  // This is a stub - actual usage should get userId from requireApiAuth/requireApiCarrier/etc
  throw new Error("getCurrentUserIds is deprecated. Use requireApiAuth() from lib/auth-api-helper instead");
}

/**
 * DEPRECATED: Use direct WHERE clauses with supabase_user_id instead
 */
export async function getCurrentUserWhere(
  columnName: 'clerk_user_id' | 'carrier_user_id' | 'admin_user_id' | 'winner_user_id' | 'sender_id' | 'user_id',
  columnPrefix: string = ''
): Promise<Sql<Record<string, unknown>>> {
  // This is a stub - routes should use direct WHERE clauses
  throw new Error("getCurrentUserWhere is deprecated. Use direct WHERE supabase_user_id = ${userId} queries instead");
}

/**
 * DEPRECATED: Insert directly with supabase_user_id instead
 */
export async function insertWithUserIds<T extends Record<string, unknown>>(
  table: string,
  data: T & { supabase_user_id?: string }
): Promise<void> {
  throw new Error("insertWithUserIds is deprecated. Insert directly with supabase_user_id field");
}
