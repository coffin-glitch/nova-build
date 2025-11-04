/**
 * Script to match user_roles_cache records by email to Supabase Auth users
 * This updates NULL supabase_user_id records with their actual Supabase user IDs
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseService } from '../lib/supabase';
import sql from '../lib/db';

config({ path: resolve(process.cwd(), '.env.local') });

async function matchUsersToSupabase() {
  try {
    console.log('🔍 Matching user_roles_cache records to Supabase Auth users...\n');

    const supabase = getSupabaseService();

    // Get all users from Supabase Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing Supabase users:', listError.message);
      process.exit(1);
    }

    console.log(`📊 Found ${users.length} users in Supabase Auth\n`);

    // Get user_roles_cache records that need matching
    const cacheRecords = await sql`
      SELECT supabase_user_id, email, role
      FROM user_roles_cache
      WHERE email IN ('duke@novafreight.io', 'dukeisaac12@gmail.com', 'alamodeunt@gmail.com')
      ORDER BY email
    `;

    console.log(`📋 Found ${cacheRecords.length} records in user_roles_cache to check:\n`);

    for (const record of cacheRecords) {
      const supabaseUser = users.find(u => 
        u.email?.toLowerCase() === record.email.toLowerCase()
      );

      if (supabaseUser) {
        if (!record.supabase_user_id || record.supabase_user_id !== supabaseUser.id) {
          console.log(`✅ Updating ${record.email}:`);
          console.log(`   Old ID: ${record.supabase_user_id || 'NULL'}`);
          console.log(`   New ID: ${supabaseUser.id}`);
          
          await sql`
            UPDATE user_roles_cache
            SET supabase_user_id = ${supabaseUser.id}
            WHERE email = ${record.email}
          `;
          
          console.log(`   ✅ Updated!\n`);
        } else {
          console.log(`✓ ${record.email}: Already matched (${supabaseUser.id})\n`);
        }
      } else {
        console.log(`❌ ${record.email}: Not found in Supabase Auth\n`);
      }
    }

    // Final check
    console.log('\n📊 Final user_roles_cache state:');
    const finalRecords = await sql`
      SELECT supabase_user_id, email, role
      FROM user_roles_cache
      WHERE email IN ('duke@novafreight.io', 'dukeisaac12@gmail.com', 'alamodeunt@gmail.com')
      ORDER BY role, email
    `;

    finalRecords.forEach((r: any) => {
      console.log(`   ${r.role.padEnd(8)} | ${r.email.padEnd(25)} | ${r.supabase_user_id || 'NULL'}`);
    });

    console.log('\n✅ Matching complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

matchUsersToSupabase();


