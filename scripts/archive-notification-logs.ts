/**
 * Archive Old Notification Logs
 * 
 * This script archives notification logs older than 90 days to the archive table.
 * Run this daily via cron or scheduled task.
 * 
 * Usage:
 *   tsx scripts/archive-notification-logs.ts
 */

import 'dotenv/config';
import sql from '../lib/db';

async function archiveNotificationLogs() {
  try {
    console.log('🔄 Starting notification logs archival...');
    
    // Call the archive function
    const result = await sql`
      SELECT archive_old_notification_logs() as archived_count
    `;
    
    const archivedCount = result[0]?.archived_count || 0;
    
    console.log(`✅ Archived ${archivedCount} notification log(s) older than 90 days`);
    
    // Optional: Clean up very old archives (older than 1 year)
    // Uncomment if you want to remove archives older than 1 year
    // const cleanupResult = await sql`
    //   SELECT cleanup_old_archived_logs() as deleted_count
    // `;
    // const deletedCount = cleanupResult[0]?.deleted_count || 0;
    // console.log(`🗑️  Cleaned up ${deletedCount} archived log(s) older than 1 year`);
    
    return archivedCount;
  } catch (error) {
    console.error('❌ Error archiving notification logs:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  archiveNotificationLogs()
    .then((count) => {
      console.log(`✨ Archival complete. ${count} logs archived.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Archival failed:', error);
      process.exit(1);
    });
}

export { archiveNotificationLogs };

