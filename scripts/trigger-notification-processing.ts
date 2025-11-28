/**
 * Script to manually trigger notification processing for test bids
 * This enqueues jobs in Redis for the notification worker to process
 */

// Load environment variables BEFORE importing db
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then fall back to .env
const envLocal = config({ path: resolve(process.cwd(), '.env.local') });
const env = config({ path: resolve(process.cwd(), '.env') });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local or .env');
  process.exit(1);
}

async function triggerWebhook(bidNumber: string) {
  const webhookUrl = process.env.WEBHOOK_URL 
    || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/new-bid` : null)
    || (process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/new-bid` : null)
    || 'http://localhost:3000/api/webhooks/new-bid';
  const webhookKey = process.env.WEBHOOK_API_KEY;
  
  console.log(`   Calling webhook: ${webhookUrl}`);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookKey ? { 'x-webhook-key': webhookKey } : {}),
      },
      body: JSON.stringify({ bidNumber }),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ Success: ${result.message || 'Webhook triggered'}`);
      console.log(`      Users processed: ${result.usersProcessed || 0}`);
      console.log(`      Total triggers: ${result.totalTriggers || 0}`);
      return true;
    } else {
      const error = await response.text();
      console.log(`   ⚠️  Webhook returned ${response.status}: ${error}`);
      return false;
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    console.log('🔔 Triggering notification processing for test bids...\n');
    
    const testBidNumbers = ['999990001', '999990002', '999990003'];
    let successCount = 0;
    
    for (const bidNumber of testBidNumbers) {
      console.log(`📤 Triggering webhook for #${bidNumber}...`);
      const success = await triggerWebhook(bidNumber);
      if (success) successCount++;
      
      // Small delay between webhook calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 Summary: ${successCount}/${testBidNumbers.length} webhooks triggered successfully`);
    
    if (successCount > 0) {
      console.log('\n✅ Jobs have been enqueued!');
      console.log('   The Railway worker should pick them up and process notifications.');
      console.log('   Check Railway logs to see processing activity.');
    } else {
      console.log('\n⚠️  No webhooks succeeded.');
      console.log('   The notification worker will still process bids on the next cron cycle (every 2 minutes).');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error triggering notifications:', error);
    process.exit(1);
  }
}

main();

