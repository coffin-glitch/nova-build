import sql from '@/lib/db';

/**
 * Get admin display name with fallback chain:
 * 1. admin_profiles.display_name
 * 2. admin_profiles.display_email
 * 3. user_roles_cache.email (system email)
 * 4. adminUserId (as last resort)
 */
export async function getAdminDisplayName(adminUserId: string): Promise<string> {
  if (!adminUserId) {
    return 'Admin';
  }

  try {
    const result = await sql`
      SELECT 
        ap.display_name,
        ap.display_email,
        ur.email as system_email
      FROM user_roles_cache ur
      LEFT JOIN admin_profiles ap ON ur.supabase_user_id = ap.supabase_user_id
      WHERE ur.supabase_user_id = ${adminUserId}
        AND ur.role = 'admin'
      LIMIT 1
    `;

    if (result.length === 0) {
      return adminUserId;
    }

    const admin = result[0];
    
    // Fallback chain: display_name > display_email > system_email > user_id
    return admin.display_name 
      || admin.display_email 
      || admin.system_email 
      || adminUserId;
  } catch (error) {
    console.error('Error fetching admin display name:', error);
    return adminUserId;
  }
}

/**
 * Get admin display names for multiple admin user IDs (batch)
 * Returns a map of adminUserId -> displayName
 */
export async function getAdminDisplayNames(adminUserIds: string[]): Promise<Map<string, string>> {
  const displayNames = new Map<string, string>();

  if (!adminUserIds || adminUserIds.length === 0) {
    return displayNames;
  }

  try {
    const results = await sql`
      SELECT 
        ur.supabase_user_id as admin_user_id,
        ap.display_name,
        ap.display_email,
        ur.email as system_email
      FROM user_roles_cache ur
      LEFT JOIN admin_profiles ap ON ur.supabase_user_id = ap.supabase_user_id
      WHERE ur.supabase_user_id = ANY(${adminUserIds})
        AND ur.role = 'admin'
    `;

    for (const admin of results) {
      const displayName = admin.display_name 
        || admin.display_email 
        || admin.system_email 
        || admin.admin_user_id;
      displayNames.set(admin.admin_user_id, displayName);
    }

    // Fill in missing admins with their user ID
    for (const adminId of adminUserIds) {
      if (!displayNames.has(adminId)) {
        displayNames.set(adminId, adminId);
      }
    }
  } catch (error) {
    console.error('Error fetching admin display names:', error);
    // Fallback: use user IDs
    adminUserIds.forEach(id => displayNames.set(id, id));
  }

  return displayNames;
}

