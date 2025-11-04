/**
 * Backfill Script: Map Clerk Users to Supabase Users
 * 
 * This script maps existing Clerk users to Supabase users by matching email addresses.
 * It populates the supabase_user_id columns added in migration 053.
 * 
 * Usage:
 *   tsx scripts/backfill-supabase-user-ids.ts [--dry-run] [--batch-size=100]
 * 
 * Options:
 *   --dry-run        Show what would be updated without making changes
 *   --batch-size=N   Process N users at a time (default: 100)
 */

import 'dotenv/config';
import sql from '../lib/db';
import { getSupabaseService } from '../lib/supabase';

interface ClerkUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface MappingResult {
  clerkUserId: string;
  supabaseUserId: string | null;
  email: string;
  status: 'mapped' | 'unmapped' | 'error';
  error?: string;
}

async function getClerkUsers(): Promise<ClerkUser[]> {
  // Get all users from user_roles_cache (they should have emails)
  const users = await sql`
    SELECT DISTINCT
      clerk_user_id as id,
      email,
      NULL as "firstName",
      NULL as "lastName"
    FROM user_roles_cache
    WHERE email IS NOT NULL AND email != ''
    ORDER BY clerk_user_id
  `;
  
  return users as ClerkUser[];
}

async function findSupabaseUserByEmail(email: string): Promise<string | null> {
  try {
    const supabase = getSupabaseService();
    
    // List users and find by email
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (error) {
        console.error(`Error listing Supabase users (page ${page}):`, error);
        return null;
      }
      
      // Find user by email (case-insensitive)
      const user = data.users.find(u => 
        u.email?.toLowerCase() === email.toLowerCase()
      );
      
      if (user) {
        return user.id;
      }
      
      // If no more pages, stop
      if (data.users.length < perPage) {
        break;
      }
      
      page++;
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding Supabase user for ${email}:`, error);
    return null;
  }
}

async function backfillUserMappings(
  batchSize: number = 100,
  dryRun: boolean = false
): Promise<void> {
  console.log('🚀 Starting Supabase user ID backfill...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be saved)'}`);
  console.log(`   Batch size: ${batchSize}\n`);
  
  // Get all Clerk users
  const clerkUsers = await getClerkUsers();
  console.log(`📊 Found ${clerkUsers.length} users to process\n`);
  
  const results: MappingResult[] = [];
  let processed = 0;
  let mapped = 0;
  let unmapped = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < clerkUsers.length; i += batchSize) {
    const batch = clerkUsers.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} users)...`);
    
    for (const user of batch) {
      try {
        // Find matching Supabase user
        const supabaseUserId = await findSupabaseUserByEmail(user.email);
        
        if (supabaseUserId) {
          // Update user_roles_cache
          if (!dryRun) {
            await sql`
              UPDATE user_roles_cache
              SET supabase_user_id = ${supabaseUserId}
              WHERE clerk_user_id = ${user.id}
            `;
          }
          
          // Update carrier_profiles if exists
          if (!dryRun) {
            await sql`
              UPDATE carrier_profiles
              SET supabase_user_id = ${supabaseUserId}
              WHERE clerk_user_id = ${user.id}
            `;
          }
          
          results.push({
            clerkUserId: user.id,
            supabaseUserId,
            email: user.email,
            status: 'mapped',
          });
          mapped++;
        } else {
          results.push({
            clerkUserId: user.id,
            supabaseUserId: null,
            email: user.email,
            status: 'unmapped',
          });
          unmapped++;
        }
        
        processed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          clerkUserId: user.id,
          supabaseUserId: null,
          email: user.email,
          status: 'error',
          error: errorMsg,
        });
        errors++;
        processed++;
        
        console.error(`  ❌ Error processing ${user.email}: ${errorMsg}`);
      }
      
      // Progress indicator
      if (processed % 10 === 0) {
        process.stdout.write(`  Processed: ${processed}/${clerkUsers.length}\r`);
      }
    }
    
    console.log(`  ✅ Batch complete (${mapped} mapped, ${unmapped} unmapped, ${errors} errors)\n`);
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < clerkUsers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Backfill related tables
  console.log('🔄 Backfilling related tables...');
  await backfillRelatedTables(dryRun);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`✅ Mapped: ${mapped}`);
  console.log(`⚠️  Unmapped: ${unmapped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60) + '\n');
  
  // Show unmapped users
  if (unmapped > 0) {
    console.log('⚠️  Unmapped users (no matching Supabase account):');
    results
      .filter(r => r.status === 'unmapped')
      .slice(0, 10)
      .forEach(r => {
        console.log(`   - ${r.email} (${r.clerkUserId})`);
      });
    if (unmapped > 10) {
      console.log(`   ... and ${unmapped - 10} more`);
    }
    console.log('');
  }
  
  // Show errors
  if (errors > 0) {
    console.log('❌ Errors:');
    results
      .filter(r => r.status === 'error')
      .slice(0, 5)
      .forEach(r => {
        console.log(`   - ${r.email}: ${r.error}`);
      });
    console.log('');
  }
  
  if (dryRun) {
    console.log('ℹ️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('✅ Backfill complete!\n');
  }
}

async function backfillRelatedTables(dryRun: boolean): Promise<void> {
  // Update all tables that reference clerk_user_id
  const tables = [
    {
      table: 'carrier_bids',
      clerkColumn: 'clerk_user_id',
      supabaseColumn: 'supabase_user_id',
    },
    {
      table: 'auction_awards',
      clerkColumn: 'winner_user_id',
      supabaseColumn: 'supabase_winner_user_id',
    },
    {
      table: 'auction_awards',
      clerkColumn: 'awarded_by',
      supabaseColumn: 'supabase_awarded_by',
    },
    {
      table: 'conversations',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'conversations',
      clerkColumn: 'admin_user_id',
      supabaseColumn: 'supabase_admin_user_id',
    },
    {
      table: 'conversation_messages',
      clerkColumn: 'sender_id',
      supabaseColumn: 'supabase_sender_id',
    },
    {
      table: 'message_reads',
      clerkColumn: 'user_id',
      supabaseColumn: 'supabase_user_id',
    },
    {
      table: 'carrier_chat_messages',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'admin_messages',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'admin_messages',
      clerkColumn: 'admin_user_id',
      supabaseColumn: 'supabase_admin_user_id',
    },
    {
      table: 'load_offers',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'assignments',
      clerkColumn: 'user_id',
      supabaseColumn: 'supabase_user_id',
    },
    {
      table: 'telegram_bid_offers',
      clerkColumn: 'user_id',
      supabaseColumn: 'supabase_user_id',
    },
    {
      table: 'carrier_bid_history',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'notification_triggers',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'notification_logs',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'carrier_favorites',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'carrier_notification_preferences',
      clerkColumn: 'carrier_user_id',
      supabaseColumn: 'supabase_carrier_user_id',
    },
    {
      table: 'bid_messages',
      clerkColumn: 'sender_id',
      supabaseColumn: 'supabase_sender_id',
    },
  ];
  
  for (const { table, clerkColumn, supabaseColumn } of tables) {
    try {
      if (!dryRun) {
        // Use user_roles_cache as the mapping source
        const result = await sql`
          UPDATE ${sql(table)}
          SET ${sql(supabaseColumn)} = urc.supabase_user_id
          FROM user_roles_cache urc
          WHERE ${sql(table)}.${sql(clerkColumn)} = urc.clerk_user_id
            AND urc.supabase_user_id IS NOT NULL
            AND ${sql(table)}.${sql(supabaseColumn)} IS NULL
        `;
        
        console.log(`   ✅ Updated ${table}.${supabaseColumn}`);
      } else {
        const count = await sql`
          SELECT COUNT(*) as count
          FROM ${sql(table)} t
          JOIN user_roles_cache urc ON t.${sql(clerkColumn)} = urc.clerk_user_id
          WHERE urc.supabase_user_id IS NOT NULL
            AND t.${sql(supabaseColumn)} IS NULL
        `;
        
        console.log(`   📊 Would update ${count[0]?.count || 0} rows in ${table}.${supabaseColumn}`);
      }
    } catch (error) {
      console.error(`   ❌ Error updating ${table}.${supabaseColumn}:`, error);
    }
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set in environment');
  console.error('   Please set it in your .env.local file');
  process.exit(1);
}

backfillUserMappings(batchSize, dryRun)
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
