/**
 * Resource-Level Authorization Utilities
 * 
 * Provides helper functions for verifying resource ownership and access control
 * at the property level for sensitive fields.
 */

import sql from "@/lib/db";
import { NextResponse } from "next/server";
import type { UserRole } from "./auth-unified";

export interface ResourceOwnershipCheck {
  resourceId: string;
  userId: string;
  userRole: UserRole;
}

/**
 * Verify that a carrier owns a specific offer
 */
export async function verifyOfferOwnership(
  offerId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    SELECT id FROM load_offers 
    WHERE id = ${offerId} AND supabase_user_id = ${userId}
    LIMIT 1
  `;
  return result.length > 0;
}

/**
 * Verify that a carrier owns a specific bid (awarded to them)
 */
export async function verifyBidOwnership(
  bidNumber: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM auction_awards 
    WHERE bid_number = ${bidNumber} 
      AND supabase_winner_user_id = ${userId}
    LIMIT 1
  `;
  return result.length > 0;
}

/**
 * Verify that a carrier owns a specific load offer
 */
export async function verifyLoadOfferOwnership(
  loadOfferId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    SELECT id FROM load_offers 
    WHERE id = ${loadOfferId} AND supabase_user_id = ${userId}
    LIMIT 1
  `;
  return result.length > 0;
}

/**
 * Verify that a carrier owns a specific conversation
 */
export async function verifyConversationOwnership(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    SELECT id FROM conversations 
    WHERE id = ${conversationId} AND supabase_carrier_user_id = ${userId}
    LIMIT 1
  `;
  return result.length > 0;
}

/**
 * Filter sensitive fields from response based on user role
 * 
 * @param data - The data object to filter
 * @param userRole - The role of the requesting user
 * @returns Filtered data with sensitive fields removed for non-admin users
 */
export function filterSensitiveFields<T extends Record<string, any>>(
  data: T,
  userRole: UserRole
): T {
  if (userRole === 'admin') {
    return data; // Admins see everything
  }

  // Fields that should never be exposed to non-admin users
  const sensitiveFields = [
    'margin_cents',
    'admin_notes',
    'internal_notes',
    'review_notes',
    'decline_reason',
    'is_internal',
    'sensitive_data',
    'confidential'
  ];

  const filtered = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in filtered) {
      delete filtered[field];
    }
  }

  return filtered;
}

/**
 * Filter sensitive fields from an array of objects
 */
export function filterSensitiveFieldsFromArray<T extends Record<string, any>>(
  data: T[],
  userRole: UserRole
): T[] {
  return data.map(item => filterSensitiveFields(item, userRole));
}

/**
 * Create a forbidden response for unauthorized resource access
 */
export function forbiddenResourceResponse(resourceType: string = 'resource'): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message: `You do not have access to this ${resourceType}`
    },
    { status: 403 }
  );
}

/**
 * Verify resource ownership and return appropriate response if unauthorized
 * 
 * @param check - The ownership check configuration
 * @param verifyFn - Function to verify ownership
 * @returns null if authorized, NextResponse if unauthorized
 */
export async function checkResourceOwnership(
  check: ResourceOwnershipCheck,
  verifyFn: (resourceId: string, userId: string) => Promise<boolean>
): Promise<NextResponse | null> {
  // Admins can access all resources
  if (check.userRole === 'admin') {
    return null;
  }

  const isOwner = await verifyFn(check.resourceId, check.userId);
  
  if (!isOwner) {
    return forbiddenResourceResponse();
  }

  return null;
}

