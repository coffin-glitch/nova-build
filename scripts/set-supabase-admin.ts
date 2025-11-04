#!/usr/bin/env node
/**
 * Set Supabase User Admin Role Script
 * 
 * Usage: npx tsx scripts/set-supabase-admin.ts <email>
 * 
 * This script sets a Supabase user as an admin in the user_roles table.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });
import { getSupabaseService } from '../lib/supabase';
import sql from '../lib/db';

async function setSupabaseAdmin(email: string) {
  if (!email) {
    console.error('❌ Error: Email is required');
    console.log('Usage: npx tsx scripts/set-supabase-admin.ts <email>');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking up user with email: ${email}...`);

    // Get Supabase service client
    const supabase = getSupabaseService();

    // Find user by email using Supabase Admin API
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const user = users.find(u => u.email === email.toLowerCase());

    if (!user) {
      console.error(`❌ Error: User with email "${email}" not found in Supabase Auth`);
      console.log('\n💡 Tip: Make sure the user has signed up first');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Check if user already has a role in user_roles_cache (it has email column)
    const existingRoleCache = await sql`
      SELECT role FROM user_roles_cache 
      WHERE email = ${email.toLowerCase()} 
         OR supabase_user_id = ${user.id}
      LIMIT 1
    `;

    // Also check user_roles table (uses user_id, not email)
    const existingRole = await sql`
      SELECT role FROM user_roles 
      WHERE user_id = ${user.id}
      LIMIT 1
    `;

    const currentRole = existingRoleCache[0]?.role || existingRole[0]?.role;

    if (currentRole === 'admin') {
      console.log('✅ User is already an admin');
      
      // Make sure both tables are updated
      const existingUserRole = await sql`
        SELECT user_id FROM user_roles WHERE user_id = ${user.id} LIMIT 1
      `;
      
      if (existingUserRole.length > 0) {
        await sql`UPDATE user_roles SET role = 'admin' WHERE user_id = ${user.id}`;
      } else {
        await sql`INSERT INTO user_roles (user_id, role, created_at) VALUES (${user.id}, 'admin', NOW())`;
      }
      
      await sql`
        INSERT INTO user_roles_cache (
          email, 
          role, 
          supabase_user_id,
          clerk_user_id,
          last_synced
        ) VALUES (
          ${email.toLowerCase()}, 
          'admin', 
          ${user.id},
          ${user.id}, -- Use Supabase ID as clerk_user_id fallback
          NOW()
        )
        ON CONFLICT (clerk_user_id) 
        DO UPDATE SET 
          role = 'admin',
          supabase_user_id = ${user.id},
          email = ${email.toLowerCase()},
          last_synced = NOW()
      `;
      
      return;
    } else if (currentRole) {
      console.log(`⚠️  User currently has role: ${currentRole}`);
      console.log('   Updating to admin...');
    }

    // Set user as admin in user_roles table (uses user_id as primary key)
    // Check if there's an existing record first
    const existingUserRole = await sql`
      SELECT user_id, role FROM user_roles 
      WHERE user_id = ${user.id}
      LIMIT 1
    `;
    
    if (existingUserRole.length > 0) {
      // Update existing record
      await sql`
        UPDATE user_roles 
        SET role = 'admin'
        WHERE user_id = ${user.id}
      `;
      console.log('✅ Updated existing user_roles record');
    } else {
      // Insert new record
      await sql`
        INSERT INTO user_roles (user_id, role, created_at)
        VALUES (${user.id}, 'admin', NOW())
      `;
      console.log('✅ Created new user_roles record');
    }

    // Also update user_roles_cache (it has email column)
    try {
      await sql`
        INSERT INTO user_roles_cache (
          email, 
          role, 
          supabase_user_id,
          clerk_user_id,
          last_synced
        ) VALUES (
          ${email.toLowerCase()}, 
          'admin', 
          ${user.id},
          ${user.id}, -- Use Supabase ID as clerk_user_id fallback
          NOW()
        )
        ON CONFLICT (clerk_user_id) 
        DO UPDATE SET 
          role = 'admin',
          supabase_user_id = ${user.id},
          email = ${email.toLowerCase()},
          last_synced = NOW()
      `;
      console.log('✅ Updated user_roles_cache');
    } catch (cacheError: any) {
      // Cache table might not exist or have different schema, that's okay
      console.log('⚠️  Could not update user_roles_cache:', cacheError.message);
    }

    console.log('✅ Successfully set user as admin');
    console.log(`   Email: ${email}`);
    console.log(`   Supabase User ID: ${user.id}`);
    console.log(`   Role: admin`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('\n💡 Refresh your browser to see the admin button!');

  } catch (error: any) {
    console.error('❌ Error setting admin role:', error.message);
    
    if (error.message.includes('relation "user_roles" does not exist')) {
      console.log('\n💡 Tip: Make sure you have run the database migrations');
      console.log('   Migration: db/migrations/053_add_supabase_user_id_columns.sql');
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Check your DATABASE_URL environment variable');
      console.log('   Make sure your database is accessible');
    }

    if (error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      console.log('\n💡 Tip: Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local');
    }
    
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email is required');
  console.log('Usage: npx tsx scripts/set-supabase-admin.ts <email>');
  console.log('\nExample:');
  console.log('  npx tsx scripts/set-supabase-admin.ts your-email@example.com');
  process.exit(1);
}

setSupabaseAdmin(email);

