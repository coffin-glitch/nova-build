/**
 * Script to sync contact_name from carrier_profiles to Supabase user metadata
 * This will update firstName/lastName for all carriers who have a contact_name set
 * 
 * Usage: npx tsx scripts/sync-contact-name-to-metadata.ts [email]
 * If email is provided, only syncs that user. Otherwise syncs all users.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then fall back to .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local or .env');
  process.exit(1);
}

import sql from '../lib/db';

// Helper function to parse contact name and extract firstName/lastName
function parseContactNameToFullName(contactName: string): { firstName: string; lastName: string } {
  if (!contactName || !contactName.trim()) {
    return { firstName: '', lastName: '' };
  }
  
  // If contact_name is an email, extract the part before @
  let nameToUse = contactName.trim();
  if (contactName.includes('@')) {
    nameToUse = contactName.split('@')[0].trim();
  }
  
  // Split into firstName and lastName
  const nameParts = nameToUse.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return { firstName, lastName };
}

// Helper function to sync contact_name to Supabase user metadata
async function syncContactNameToUserMetadata(userId: string, contactName: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn(`⚠️  Supabase credentials not configured for user ${userId}`);
      return false;
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { firstName, lastName } = parseContactNameToFullName(contactName);
    
    // Get existing user metadata to preserve other fields
    const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
    
    if (getUserError || !user) {
      console.warn(`⚠️  Could not get user ${userId} for metadata update:`, getUserError?.message);
      return false;
    }
    
    // Update user metadata with firstName and lastName
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...user.user_metadata,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: contactName || null,
      }
    });
    
    if (updateError) {
      console.warn(`⚠️  Could not update user metadata for ${userId}:`, updateError.message);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ Error syncing contact_name to user metadata for ${userId}:`, error?.message);
    return false;
  }
}

async function main() {
  try {
    const email = process.argv[2];
    
    console.log('🔄 Starting contact_name to user metadata sync...\n');
    
    let profiles;
    
    if (email) {
      // Sync specific user by email
      console.log(`📧 Looking up user by email: ${email}`);
      
      // First, get the user ID from Supabase or user_roles_cache
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase credentials not configured');
        process.exit(1);
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Try to find user by email
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('❌ Error listing users:', listError);
        process.exit(1);
      }
      
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        console.error(`❌ User not found with email: ${email}`);
        process.exit(1);
      }
      
      // Get carrier profile for this user
      profiles = await sql`
        SELECT 
          cp.supabase_user_id,
          cp.contact_name,
          cp.legal_name,
          cp.company_name
        FROM carrier_profiles cp
        WHERE cp.supabase_user_id = ${user.id}
        LIMIT 1
      `;
      
      if (profiles.length === 0) {
        console.error(`❌ No carrier profile found for user: ${email}`);
        process.exit(1);
      }
    } else {
      // Sync all users with contact_name
      console.log('📋 Syncing all carriers with contact_name...\n');
      
      profiles = await sql`
        SELECT 
          cp.supabase_user_id,
          cp.contact_name,
          cp.legal_name,
          cp.company_name
        FROM carrier_profiles cp
        WHERE cp.contact_name IS NOT NULL
          AND cp.contact_name != ''
          AND cp.supabase_user_id IS NOT NULL
        ORDER BY cp.updated_at DESC
      `;
    }
    
    if (profiles.length === 0) {
      console.log('✅ No profiles found to sync.');
      process.exit(0);
    }
    
    console.log(`📊 Found ${profiles.length} profile(s) to sync\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const profile of profiles) {
      const userId = profile.supabase_user_id;
      const contactName = profile.contact_name;
      
      if (!contactName) {
        console.log(`⏭️  Skipping ${userId} - no contact_name`);
        continue;
      }
      
      console.log(`🔄 Syncing ${userId}...`);
      console.log(`   Contact Name: ${contactName}`);
      
      const success = await syncContactNameToUserMetadata(userId, contactName);
      
      if (success) {
        console.log(`   ✅ Successfully synced to user metadata\n`);
        successCount++;
      } else {
        console.log(`   ❌ Failed to sync\n`);
        failCount++;
      }
    }
    
    console.log('\n📊 Sync Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📊 Total: ${profiles.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running sync:', error);
    process.exit(1);
  }
}

main();

