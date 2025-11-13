import { addSecurityHeaders, validateInput } from "@/lib/api-security";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Input validation
    const validation = validateInput({ limit, offset }, {
      limit: { type: 'number', min: 1, max: 100 },
      offset: { type: 'number', min: 0 }
    });

    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    // First, get users from cache
    const cachedUsers = await sql`
      SELECT 
        ur.supabase_user_id as user_id,
        ur.supabase_user_id,
        ur.role,
        ur.email,
        ur.created_at as role_created_at,
        cp.legal_name,
        cp.mc_number,
        cp.dot_number,
        cp.phone,
        cp.contact_name,
        cp.created_at as profile_created_at,
        cnp.urgent_contact_email,
        cnp.urgent_contact_phone
      FROM user_roles_cache ur
      LEFT JOIN carrier_profiles cp ON ur.supabase_user_id = cp.supabase_user_id
      LEFT JOIN carrier_notification_preferences cnp ON ur.supabase_user_id = cnp.supabase_carrier_user_id
      WHERE ur.supabase_user_id IS NOT NULL
      ORDER BY ur.created_at DESC
    `;

    // Also fetch all Supabase Auth users to find ones not in cache
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const uncachedUsers: any[] = [];

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: { users: supabaseUsers }, error: supabaseError } = await supabase.auth.admin.listUsers();
        
        if (!supabaseError && supabaseUsers) {
          const cachedUserIds = new Set(cachedUsers.map((u: any) => u.supabase_user_id?.toLowerCase()));
          
          // Find users in Supabase Auth that aren't in cache (deduplicate by user ID)
          for (const supabaseUser of supabaseUsers) {
            const userId = supabaseUser.id?.toLowerCase();
            if (userId && !cachedUserIds.has(userId)) {
              uncachedUsers.push({
                user_id: supabaseUser.id,
                supabase_user_id: supabaseUser.id,
                role: 'carrier', // Default to 'carrier' for new users
                email: supabaseUser.email || 'No email',
                role_created_at: supabaseUser.created_at,
                legal_name: null,
                mc_number: null,
                dot_number: null,
                phone: null,
                contact_name: null,
                profile_created_at: null,
                urgent_contact_email: null,
                urgent_contact_phone: null
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching uncached users from Supabase:", error);
        // Continue with cached users only if Supabase fetch fails
      }
    }

    // Combine cached and uncached users, deduplicate by supabase_user_id first
    const userMapById = new Map<string, any>();
    const emailToUserIds = new Map<string, string[]>(); // Track which user IDs have the same email
    
    // Add cached users first (they have more complete data)
    for (const user of cachedUsers) {
      const userId = user.supabase_user_id?.toLowerCase();
      const email = user.email?.toLowerCase();
      if (userId) {
        userMapById.set(userId, user);
        // Track email -> user ID mapping
        if (email) {
          if (!emailToUserIds.has(email)) {
            emailToUserIds.set(email, []);
          }
          emailToUserIds.get(email)!.push(userId);
        }
      }
    }
    
    // Add uncached users only if they don't already exist by ID
    for (const user of uncachedUsers) {
      const userId = user.supabase_user_id?.toLowerCase();
      const email = user.email?.toLowerCase();
      if (userId && !userMapById.has(userId)) {
        userMapById.set(userId, user);
        // Track email -> user ID mapping
        if (email) {
          if (!emailToUserIds.has(email)) {
            emailToUserIds.set(email, []);
          }
          emailToUserIds.get(email)!.push(userId);
        }
      }
    }
    
    // Secondary deduplication: If same email appears with multiple user IDs, keep the best one
    const finalUserMap = new Map<string, any>();
    const processedEmails = new Set<string>();
    
    // Process all users, prioritizing by data completeness and recency
    for (const [userId, user] of userMapById.entries()) {
      const email = user.email?.toLowerCase();
      
      if (!email) {
        // No email - keep as is (shouldn't happen, but handle gracefully)
        finalUserMap.set(userId, user);
        continue;
      }
      
      // Check if we've already processed this email
      if (processedEmails.has(email)) {
        // Email already processed - compare with existing user
        const existingUserIds = emailToUserIds.get(email) || [];
        const existingUserId = existingUserIds.find(id => finalUserMap.has(id));
        
        if (existingUserId) {
          const existingUser = finalUserMap.get(existingUserId);
          
          // Decide which user to keep based on:
          // 1. Has role assigned (prefer 'carrier' or 'admin' over 'none')
          // 2. Has more complete data (cached users have more fields)
          // 3. Most recent creation date
          const currentHasRole = user.role && user.role !== 'none';
          const existingHasRole = existingUser.role && existingUser.role !== 'none';
          const currentIsCached = cachedUsers.some(c => c.supabase_user_id?.toLowerCase() === userId);
          const existingIsCached = cachedUsers.some(c => c.supabase_user_id?.toLowerCase() === existingUserId);
          const currentDate = new Date(user.role_created_at || user.created_at || 0).getTime();
          const existingDate = new Date(existingUser.role_created_at || existingUser.created_at || 0).getTime();
          
          // Keep the better user
          const shouldReplace = 
            (currentHasRole && !existingHasRole) || // Current has role, existing doesn't
            (currentHasRole === existingHasRole && currentIsCached && !existingIsCached) || // Both have/not have role, but current is cached
            (currentHasRole === existingHasRole && currentIsCached === existingIsCached && currentDate > existingDate); // Same role/cache status, but current is newer
          
          if (shouldReplace) {
            finalUserMap.delete(existingUserId);
            finalUserMap.set(userId, user);
            // Update email mapping
            emailToUserIds.set(email, [userId]);
          }
          // Otherwise, keep existing user and skip current
        }
      } else {
        // First time seeing this email - add it
        finalUserMap.set(userId, user);
        processedEmails.add(email);
      }
    }
    
    // Convert map to array and sort
    const allUsers = Array.from(finalUserMap.values()).sort((a, b) => {
      const dateA = new Date(a.role_created_at || 0).getTime();
      const dateB = new Date(b.role_created_at || 0).getTime();
      return dateB - dateA; // Most recent first
    });

    const paginatedUsers = allUsers.slice(offset, offset + limit);

    const totalCount = allUsers.length;

    const response = NextResponse.json({
      ok: true,
      data: paginatedUsers.map((u: any) => ({
        user_id: u.supabase_user_id || u.user_id,
        supabase_user_id: u.supabase_user_id,
        email: u.email,
        role: u.role,
        role_created_at: u.role_created_at,
        legal_name: u.legal_name,
        company_name: u.legal_name || u.company_name || 'N/A',
        mc_number: u.mc_number,
        dot_number: u.dot_number,
        phone: u.phone,
        contact_name: u.contact_name,
        profile_created_at: u.profile_created_at,
        urgent_contact_email: u.urgent_contact_email ?? true,
        urgent_contact_phone: u.urgent_contact_phone ?? false
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: paginatedUsers.length === limit && (offset + limit) < totalCount,
      },
    });
    
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error("Admin users API error:", error);
    const response = NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const body = await request.json();
    const { user_id, role } = body;

    // Input validation
    const validation = validateInput({ user_id, role }, {
      user_id: { required: true, type: 'string', minLength: 1 },
      role: { required: true, type: 'string', pattern: /^(admin|carrier)$/ }
    });

    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user email from Supabase Auth or existing record
    let userEmail = '';
    
    // First, try to get email from existing record
    const existingRecord = await sql`
      SELECT email FROM user_roles_cache WHERE supabase_user_id = ${user_id} LIMIT 1
    `;
    
    if (existingRecord.length > 0 && existingRecord[0].email) {
      userEmail = existingRecord[0].email;
    } else {
      // Fallback: Get email from Supabase Auth
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: { user }, error } = await supabase.auth.admin.getUserById(user_id);
          
          if (!error && user?.email) {
            userEmail = user.email;
          }
        }
      } catch (supabaseError) {
        console.error("Error fetching email from Supabase:", supabaseError);
      }
    }
    
    // If still no email, use a placeholder (shouldn't happen, but prevent constraint violation)
    if (!userEmail) {
      userEmail = `user_${user_id.substring(0, 8)}@placeholder.local`;
    }

    // Update user role in user_roles_cache (Supabase-only)
    await sql`
      INSERT INTO user_roles_cache (supabase_user_id, role, email, last_synced, created_at)
      VALUES (${user_id}, ${role}, ${userEmail}, NOW(), COALESCE((SELECT created_at FROM user_roles_cache WHERE supabase_user_id = ${user_id}), NOW()))
      ON CONFLICT (supabase_user_id) DO UPDATE SET 
        role = ${role},
        email = COALESCE(EXCLUDED.email, user_roles_cache.email),
        last_synced = NOW()
    `;

    // Also update Supabase user metadata to keep in sync (helps with client-side role detection)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Update user metadata with new role
        const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
          user_metadata: { role: role }
        });
        
        if (updateError) {
          console.warn(`⚠️ [Admin Users API] Could not update user metadata:`, updateError);
          // Continue anyway - database update is more important
        } else {
          console.log(`✅ [Admin Users API] Updated Supabase user metadata for user ${user_id}`);
        }
        
        // Clear role cache in auth-unified (if available in this process)
        try {
          const { clearRoleCache } = await import('@/lib/auth-unified');
          clearRoleCache(user_id);
          console.log(`✅ [Admin Users API] Cleared role cache for user ${user_id}`);
        } catch {
          // Cache clearing is optional - continue anyway
          console.log(`ℹ️ [Admin Users API] Could not clear role cache (may be in different process)`);
        }
      }
    } catch (metadataError) {
      console.warn(`⚠️ [Admin Users API] Error updating user metadata:`, metadataError);
      // Continue anyway - database update is more important
    }

    // If switching to admin, delete carrier profile to ensure clean admin access (fresh start)
    if (role === 'admin') {
      try {
        // Delete carrier profile completely to remove all carrier history
        const carrierDeleteResult = await sql`
          DELETE FROM carrier_profiles 
          WHERE supabase_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier profile for user ${user_id} (switched to admin - fresh start). Rows deleted: ${carrierDeleteResult.length}`);
        
        // Delete carrier notification preferences
        const notifDeleteResult = await sql`
          DELETE FROM carrier_notification_preferences 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING supabase_carrier_user_id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier notification preferences for user ${user_id}. Rows deleted: ${notifDeleteResult.length}`);
        
        // Also delete any carrier-related data from other tables to ensure complete cleanup
        // Delete carrier bids
        const bidsDeleteResult = await sql`
          DELETE FROM carrier_bids 
          WHERE supabase_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier bids for user ${user_id}. Rows deleted: ${bidsDeleteResult.length}`);
        
        // Delete carrier chat messages
        const chatDeleteResult = await sql`
          DELETE FROM carrier_chat_messages 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier chat messages for user ${user_id}. Rows deleted: ${chatDeleteResult.length}`);
        
        // Delete conversations where user is the carrier
        const convDeleteResult = await sql`
          DELETE FROM conversations 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier conversations for user ${user_id}. Rows deleted: ${convDeleteResult.length}`);
        
        // Delete load offers
        const offersDeleteResult = await sql`
          DELETE FROM load_offers 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted load offers for user ${user_id}. Rows deleted: ${offersDeleteResult.length}`);
        
        // Delete carrier favorites
        const favoritesDeleteResult = await sql`
          DELETE FROM carrier_favorites 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier favorites for user ${user_id}. Rows deleted: ${favoritesDeleteResult.length}`);
        
        console.log(`✅ [Admin Users API] Complete carrier data cleanup finished for user ${user_id}`);
      } catch (profileError: any) {
        console.error(`❌ [Admin Users API] Error deleting carrier data:`, profileError);
        console.error(`❌ [Admin Users API] Error details:`, {
          message: profileError?.message,
          code: profileError?.code,
          detail: profileError?.detail,
          stack: profileError?.stack
        });
        // Continue anyway - role update is more important, but log the error
      }
    }

    // If switching to carrier, delete admin profile to ensure clean carrier access (fresh start)
    if (role === 'carrier') {
      try {
        // Delete admin profile completely to remove all admin history
        const adminDeleteResult = await sql`
          DELETE FROM admin_profiles 
          WHERE supabase_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted admin profile for user ${user_id} (switched to carrier - fresh start). Rows deleted: ${adminDeleteResult.length}`);
        
        // CRITICAL: Delete carrier profile completely to ensure fresh start
        // This ensures they start fresh and go through the profile setup flow
        const carrierDeleteResult = await sql`
          DELETE FROM carrier_profiles 
          WHERE supabase_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier profile for user ${user_id} (will redirect to profile setup). Rows deleted: ${carrierDeleteResult.length}`);
        
        // Delete carrier notification preferences
        const notifDeleteResult = await sql`
          DELETE FROM carrier_notification_preferences 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING supabase_carrier_user_id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier notification preferences for user ${user_id}. Rows deleted: ${notifDeleteResult.length}`);
        
        // Also delete any carrier-related data from other tables to ensure complete cleanup
        // Delete carrier bids
        const bidsDeleteResult = await sql`
          DELETE FROM carrier_bids 
          WHERE supabase_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier bids for user ${user_id}. Rows deleted: ${bidsDeleteResult.length}`);
        
        // Delete carrier chat messages
        const chatDeleteResult = await sql`
          DELETE FROM carrier_chat_messages 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier chat messages for user ${user_id}. Rows deleted: ${chatDeleteResult.length}`);
        
        // Delete conversations where user is the carrier
        const convDeleteResult = await sql`
          DELETE FROM conversations 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier conversations for user ${user_id}. Rows deleted: ${convDeleteResult.length}`);
        
        // Delete load offers
        const offersDeleteResult = await sql`
          DELETE FROM load_offers 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted load offers for user ${user_id}. Rows deleted: ${offersDeleteResult.length}`);
        
        // Delete carrier favorites
        const favoritesDeleteResult = await sql`
          DELETE FROM carrier_favorites 
          WHERE supabase_carrier_user_id = ${user_id}
          RETURNING id
        `;
        console.log(`✅ [Admin Users API] Deleted carrier favorites for user ${user_id}. Rows deleted: ${favoritesDeleteResult.length}`);
        
        console.log(`✅ [Admin Users API] Complete carrier data cleanup finished for user ${user_id}`);
      } catch (profileError: any) {
        console.error(`❌ [Admin Users API] Error deleting admin/carrier data:`, profileError);
        console.error(`❌ [Admin Users API] Error details:`, {
          message: profileError?.message,
          code: profileError?.code,
          detail: profileError?.detail,
          stack: profileError?.stack
        });
        // Continue anyway - role update is more important, but log the error
      }
    }

    // Clear any cached role data for this user (if cache exists in this process)
    // Note: Middleware cache is in a different process, but this helps with API-level caching
    console.log(`✅ [Admin Users API] Role updated to ${role} for user ${user_id}. User should sign out and sign back in for changes to take effect immediately.`);

    const response = NextResponse.json({
      ok: true,
      message: `User role updated to ${role}. Please sign out and sign back in for changes to take effect immediately.`,
    });
    
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error("Admin users PATCH API error:", error);
    const response = NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}

// DELETE endpoint for wiping user data or deleting account
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    
    // CRITICAL: Only main admin (duke@novafreight.io) can use wipe/delete functionality
    const mainAdminEmail = 'duke@novafreight.io';
    const currentUserEmail = auth.email || '';
    
    if (currentUserEmail.toLowerCase() !== mainAdminEmail.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "Only the main admin can use wipe/delete functionality" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { user_id, action } = body; // action: 'wipe' or 'delete'
    
    if (!user_id || !action) {
      return NextResponse.json(
        { ok: false, error: "user_id and action are required" },
        { status: 400 }
      );
    }
    
    if (action !== 'wipe' && action !== 'delete') {
      return NextResponse.json(
        { ok: false, error: "action must be 'wipe' or 'delete'" },
        { status: 400 }
      );
    }
    
    const deletionResults: Record<string, number> = {};
    
    // Wipe all user data (both admin and carrier)
    try {
      // Delete admin profile
      const adminDelete = await sql`
        DELETE FROM admin_profiles 
        WHERE supabase_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.admin_profiles = adminDelete.length;
      
      // Delete carrier profile
      const carrierDelete = await sql`
        DELETE FROM carrier_profiles 
        WHERE supabase_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.carrier_profiles = carrierDelete.length;
      
      // Delete carrier notification preferences
      const notifDelete = await sql`
        DELETE FROM carrier_notification_preferences 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING supabase_carrier_user_id
      `;
      deletionResults.carrier_notification_preferences = notifDelete.length;
      
      // Delete carrier bids
      const bidsDelete = await sql`
        DELETE FROM carrier_bids 
        WHERE supabase_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.carrier_bids = bidsDelete.length;
      
      // Delete carrier chat messages
      const chatDelete = await sql`
        DELETE FROM carrier_chat_messages 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.carrier_chat_messages = chatDelete.length;
      
      // Delete conversations where user is carrier
      const convDelete = await sql`
        DELETE FROM conversations 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.conversations = convDelete.length;
      
      // Delete load offers
      const offersDelete = await sql`
        DELETE FROM load_offers 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.load_offers = offersDelete.length;
      
      // Delete carrier favorites
      const favoritesDelete = await sql`
        DELETE FROM carrier_favorites 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.carrier_favorites = favoritesDelete.length;
      
      // Delete carrier bid history
      const bidHistoryDelete = await sql`
        DELETE FROM carrier_bid_history 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.carrier_bid_history = bidHistoryDelete.length;
      
      // Delete notification triggers
      const triggersDelete = await sql`
        DELETE FROM notification_triggers 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.notification_triggers = triggersDelete.length;
      
      // Delete notification logs
      const logsDelete = await sql`
        DELETE FROM notification_logs 
        WHERE supabase_carrier_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.notification_logs = logsDelete.length;
      
      // Delete message reads
      const readsDelete = await sql`
        DELETE FROM message_reads 
        WHERE supabase_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.message_reads = readsDelete.length;
      
      // Delete conversation messages where user is sender
      const msgDelete = await sql`
        DELETE FROM conversation_messages 
        WHERE supabase_sender_id = ${user_id}
        RETURNING id
      `;
      deletionResults.conversation_messages = msgDelete.length;
      
      // Delete admin messages
      const adminMsgDelete = await sql`
        DELETE FROM admin_messages 
        WHERE supabase_carrier_user_id = ${user_id} OR supabase_admin_user_id = ${user_id}
        RETURNING id
      `;
      deletionResults.admin_messages = adminMsgDelete.length;
      
      console.log(`✅ [Admin Users API] Wiped all data for user ${user_id}:`, deletionResults);
      
      // If action is 'delete', also delete from user_roles_cache and Supabase Auth
      if (action === 'delete') {
        // Delete from user_roles_cache
        await sql`
          DELETE FROM user_roles_cache 
          WHERE supabase_user_id = ${user_id}
        `;
        
        // Delete from Supabase Auth
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);
          
          if (deleteError) {
            console.error(`❌ [Admin Users API] Error deleting user from Supabase Auth:`, deleteError);
            throw new Error(`Failed to delete user from Supabase Auth: ${deleteError.message}`);
          }
          
          console.log(`✅ [Admin Users API] Permanently deleted user ${user_id} from Supabase Auth`);
        }
      }
      
      const response = NextResponse.json({
        ok: true,
        message: action === 'wipe' 
          ? 'All user data wiped successfully' 
          : 'User account permanently deleted',
        deletionResults
      });
      
      return addSecurityHeaders(response);
    } catch (wipeError: any) {
      console.error(`❌ [Admin Users API] Error wiping/deleting user data:`, wipeError);
      throw wipeError;
    }
  } catch (error: any) {
    console.error("Admin users DELETE API error:", error);
    const response = NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}
