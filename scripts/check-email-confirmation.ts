/**
 * Script to check if a user has confirmed their email in Supabase
 * Usage: tsx scripts/check-email-confirmation.ts <email>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkEmailConfirmation(email: string) {
  try {
    console.log(`\n🔍 Checking email confirmation status for: ${email}\n`);

    // List all users and find the one with matching email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    console.log('✅ User found!');
    console.log('\n📊 User Details:');
    console.log('─'.repeat(50));
    console.log(`   User ID:        ${user.id}`);
    console.log(`   Email:          ${user.email}`);
    console.log(`   Created:        ${new Date(user.created_at).toLocaleString()}`);
    console.log(`   Last Sign In:   ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
    console.log(`   Email Confirmed: ${user.email_confirmed_at ? '✅ YES' : '❌ NO'}`);
    
    if (user.email_confirmed_at) {
      console.log(`   Confirmed At:   ${new Date(user.email_confirmed_at).toLocaleString()}`);
    } else {
      console.log(`   ⚠️  Email not confirmed yet!`);
    }

    console.log(`   Phone:          ${user.phone || 'Not set'}`);
    console.log(`   Phone Confirmed: ${user.phone_confirmed_at ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n🔐 Auth Methods:');
    console.log('─'.repeat(50));
    user.app_metadata.providers?.forEach((provider: string, index: number) => {
      console.log(`   ${index + 1}. ${provider}`);
    });

    console.log('\n📝 User Metadata:');
    console.log('─'.repeat(50));
    console.log(JSON.stringify(user.user_metadata, null, 2));

    // Check role in database
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles_cache')
        .select('*')
        .eq('email', email)
        .single();

      if (roleData) {
        console.log('\n👤 Database Role:');
        console.log('─'.repeat(50));
        console.log(`   Role: ${roleData.role || 'Not set'}`);
        console.log(`   User ID: ${roleData.supabase_user_id || roleData.clerk_user_id || 'Not set'}`);
      }
    } catch (err) {
      // Role not found, that's okay
    }

    console.log('\n' + '═'.repeat(50));
    
    if (!user.email_confirmed_at) {
      console.log('\n💡 To resend confirmation email, use Supabase Dashboard:');
      console.log(`   https://app.supabase.com/project/${SUPABASE_URL.split('//')[1].split('.')[0]}/auth/users`);
      console.log(`   Or run: tsx scripts/resend-confirmation.ts ${email}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('Usage: tsx scripts/check-email-confirmation.ts <email>');
  process.exit(1);
}

checkEmailConfirmation(email);



