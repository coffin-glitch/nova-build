/**
 * Script to fix exact_match triggers that are missing favoriteBidNumbers
 * This will update triggers to use the user's favorited bids
 * Usage: tsx scripts/fix-exact-match-triggers.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import sql from '../lib/db';

async function fixExactMatchTriggers() {
  console.log('🔧 Fixing exact_match triggers...\n');

  // Find all exact_match triggers without favoriteBidNumbers
  const triggers = await sql`
    SELECT 
      nt.id,
      nt.supabase_carrier_user_id,
      nt.trigger_config,
      nt.trigger_type
    FROM notification_triggers nt
    WHERE nt.trigger_type = 'exact_match'
      AND nt.is_active = true
  `;

  console.log(`Found ${triggers.length} exact_match triggers\n`);

  let fixed = 0;
  let skipped = 0;

  for (const trigger of triggers) {
    // Parse trigger_config
    let config = trigger.trigger_config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch {
        config = {};
      }
    }

    // Check if favoriteBidNumbers is missing or empty
    if (!config.favoriteBidNumbers || config.favoriteBidNumbers.length === 0) {
      console.log(`⚠️  Trigger ${trigger.id} missing favoriteBidNumbers`);

      // Get user's favorited bids
      const favorites = await sql`
        SELECT bid_number
        FROM carrier_favorites
        WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
        ORDER BY created_at DESC
        LIMIT 5
      `;

      if (favorites.length === 0) {
        console.log(`   ❌ No favorites found for user ${trigger.supabase_carrier_user_id.substring(0, 8)}...`);
        console.log(`   💡 User needs to favorite a bid first\n`);
        skipped++;
        continue;
      }

      // Update trigger with favorite bid numbers
      const updatedConfig = {
        ...config,
        favoriteBidNumbers: favorites.map((f: any) => f.bid_number),
        matchType: config.matchType || 'exact',
      };

      await sql`
        UPDATE notification_triggers
        SET 
          trigger_config = ${JSON.stringify(updatedConfig)},
          updated_at = NOW()
        WHERE id = ${trigger.id}
      `;

      console.log(`   ✅ Fixed! Added ${favorites.length} favorite bid(s): ${favorites.map((f: any) => f.bid_number).join(', ')}\n`);
      fixed++;
    } else {
      console.log(`✅ Trigger ${trigger.id} already has favoriteBidNumbers: ${config.favoriteBidNumbers.join(', ')}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Skipped: ${skipped} (no favorites)`);
  console.log(`   Total: ${triggers.length}`);
  console.log('='.repeat(60));
}

fixExactMatchTriggers()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

