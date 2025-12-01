/**
 * Check user metadata for a specific email
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

import sql from '../lib/db';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const email = process.argv[2] || 'dukeisaac12@gmail.com';
  
  console.log(`🔍 Checking user metadata for: ${email}\n`);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Find user by email
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
  
  console.log(`✅ Found user: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   User Metadata:`);
  console.log(`     first_name: ${user.user_metadata?.first_name || 'null'}`);
  console.log(`     last_name: ${user.user_metadata?.last_name || 'null'}`);
  console.log(`     full_name: ${user.user_metadata?.full_name || 'null'}`);
  
  // Get carrier profile
  const profile = await sql`
    SELECT contact_name, legal_name, company_name
    FROM carrier_profiles
    WHERE supabase_user_id = ${user.id}
    LIMIT 1
  `;
  
  if (profile.length > 0) {
    console.log(`\n   Carrier Profile:`);
    console.log(`     contact_name: ${profile[0].contact_name || 'null'}`);
    console.log(`     legal_name: ${profile[0].legal_name || 'null'}`);
    console.log(`     company_name: ${profile[0].company_name || 'null'}`);
  } else {
    console.log(`\n   ⚠️  No carrier profile found`);
  }
  
  process.exit(0);
}

main();

