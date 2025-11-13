/**
 * Script to resend email confirmation to a user
 * Usage: tsx scripts/resend-confirmation.ts <email>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function resendConfirmation(email: string) {
  try {
    console.log(`\n📧 Resending confirmation email to: ${email}\n`);

    // Generate a confirmation link
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      password: Math.random().toString(36).slice(-12), // Generate random password for signup link
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log('✅ Confirmation link generated!');
    console.log('\n🔗 Confirmation Link:');
    console.log('─'.repeat(50));
    console.log(data.properties.action_link);
    console.log('\n💡 Send this link to the user or configure Resend to send it automatically.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: tsx scripts/resend-confirmation.ts <email>');
  process.exit(1);
}

resendConfirmation(email);



