import sql from "./db";

/**
 * Helper function to query carrier profile by user ID (Supabase-only)
 */
export async function getCarrierProfileByUserId(userId: string) {
  const profiles = await sql`
    SELECT 
      supabase_user_id,
      id,
      legal_name,
      company_name,
      mc_number,
      dot_number,
      contact_name,
      phone,
      profile_status,
      submitted_at,
      reviewed_at,
      reviewed_by,
      review_notes,
      decline_reason,
      is_first_login,
      profile_completed_at,
      edits_enabled,
      edits_enabled_by,
      edits_enabled_at,
      created_at,
      updated_at
    FROM carrier_profiles 
    WHERE supabase_user_id = ${userId}
    LIMIT 1
  `;
  
  return profiles.length > 0 ? profiles[0] : null;
}

/**
 * Helper function to get the primary user ID for a carrier profile (Supabase-only)
 */
export function getPrimaryUserId(profile: { supabase_user_id?: string | null }): string | null {
  return profile.supabase_user_id || null;
}

/**
 * Helper function to update carrier profile by user ID (Supabase-only)
 */
export async function updateCarrierProfileByUserId(
  userId: string,
  updates: {
    profile_status?: string;
    reviewed_at?: Date | null;
    reviewed_by?: string | null;
    review_notes?: string | null;
    decline_reason?: string | null;
    edits_enabled?: boolean;
    edits_enabled_by?: string | null;
    edits_enabled_at?: Date | null;
    submitted_at?: Date | null;
    [key: string]: any;
  }
) {
  const updateFields: string[] = [];
  const values: any[] = [];
  
  Object.entries(updates).forEach(([key, value], index) => {
    if (value !== undefined) {
      updateFields.push(`${key} = $${index + 1}`);
      values.push(value);
    }
  });
  
  if (updateFields.length === 0) {
    return;
  }
  
  // Add user ID condition at the end
  values.push(userId);
  
  // Build query with WHERE clause using supabase_user_id only
  const query = `
    UPDATE carrier_profiles 
    SET ${updateFields.join(', ')}
    WHERE supabase_user_id = $${values.length}
  `;
  
  await sql.unsafe(query, values);
}

