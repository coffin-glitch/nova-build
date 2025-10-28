import sql from '@/lib/db';

/**
 * Archive System Migration Strategy
 * 
 * This file establishes the consolidated approach for bid archiving
 * using archived_bids_with_metadata as the single source of truth.
 */

export interface ArchiveMigrationConfig {
  sourceTable: string;
  targetTable: string;
  batchSize: number;
  includeMetadata: boolean;
}

export const ARCHIVE_CONFIG: ArchiveMigrationConfig = {
  sourceTable: 'telegram_bids',
  targetTable: 'archived_bids_with_metadata',
  batchSize: 1000,
  includeMetadata: true
};

/**
 * Archive expired bids from telegram_bids to archived_bids_with_metadata
 * This is the main archiving function that should be used going forward
 */
export async function archiveExpiredBids(): Promise<{
  archived: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let archived = 0;

  try {
    console.log('🔄 Starting archive migration...');

    // Get expired bids that haven't been archived yet
    const expiredBids = await sql`
      SELECT 
        tb.*,
        EXTRACT(EPOCH FROM (NOW() - tb.received_at)) / 3600 as hours_active,
        CASE 
          WHEN tb.tag IS NOT NULL THEN tb.tag
          ELSE 'UNKNOWN'
        END as state_tag
      FROM telegram_bids tb
      WHERE tb.is_archived = false
      AND tb.expires_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM archived_bids_with_metadata ab 
        WHERE ab.bid_number = tb.bid_number
      )
      ORDER BY tb.received_at ASC
      LIMIT ${ARCHIVE_CONFIG.batchSize}
    `;

    console.log(`📊 Found ${expiredBids.length} bids to archive`);

    if (expiredBids.length === 0) {
      return { archived: 0, errors: [] };
    }

    // Archive each bid
    for (const bid of expiredBids) {
      try {
        await sql`
          INSERT INTO archived_bids_with_metadata (
            bid_number,
            distance_miles,
            pickup_timestamp,
            delivery_timestamp,
            stops,
            tag,
            source_channel,
            forwarded_to,
            received_at,
            archived_at,
            original_id,
            hours_active,
            state_tag
          ) VALUES (
            ${bid.bid_number},
            ${bid.distance_miles},
            ${bid.pickup_timestamp},
            ${bid.delivery_timestamp},
            ${JSON.stringify(bid.stops)},
            ${bid.tag},
            ${bid.source_channel},
            ${bid.forwarded_to},
            ${bid.received_at},
            NOW(),
            ${bid.id},
            ${bid.hours_active},
            ${bid.state_tag}
          )
          ON CONFLICT (bid_number) DO NOTHING
        `;

        // Mark as archived in telegram_bids
        await sql`
          UPDATE telegram_bids 
          SET 
            is_archived = true,
            archived_at = NOW()
          WHERE id = ${bid.id}
        `;

        archived++;
      } catch (error) {
        const errorMsg = `Failed to archive bid ${bid.bid_number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }
    }

    console.log(`✅ Successfully archived ${archived} bids`);
    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} errors occurred`);
    }

  } catch (error) {
    const errorMsg = `Archive migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('❌', errorMsg);
  }

  return { archived, errors };
}

/**
 * Verify archive system integrity
 * Checks for any inconsistencies between tables
 */
export async function verifyArchiveIntegrity(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    console.log('🔍 Verifying archive system integrity...');

    // Check for archived bids in telegram_bids that aren't in archived_bids_with_metadata
    const missingInMetadata = await sql`
      SELECT COUNT(*) as count
      FROM telegram_bids tb
      WHERE tb.is_archived = true
      AND NOT EXISTS (
        SELECT 1 FROM archived_bids_with_metadata ab 
        WHERE ab.bid_number = tb.bid_number
      )
    `;

    if (missingInMetadata[0].count > 0) {
      issues.push(`${missingInMetadata[0].count} archived bids missing from metadata table`);
    }

    // Check for bids in archived_bids_with_metadata that aren't marked as archived in telegram_bids
    const notMarkedArchived = await sql`
      SELECT COUNT(*) as count
      FROM archived_bids_with_metadata ab
      WHERE NOT EXISTS (
        SELECT 1 FROM telegram_bids tb 
        WHERE tb.bid_number = ab.bid_number AND tb.is_archived = true
      )
    `;

    if (notMarkedArchived[0].count > 0) {
      issues.push(`${notMarkedArchived[0].count} bids in metadata table not marked as archived`);
    }

    // Check for duplicate bid numbers in archived_bids_with_metadata
    const duplicates = await sql`
      SELECT bid_number, COUNT(*) as count
      FROM archived_bids_with_metadata
      GROUP BY bid_number
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} duplicate bid numbers found in metadata table`);
    }

    const isValid = issues.length === 0;
    
    if (isValid) {
      console.log('✅ Archive system integrity verified');
    } else {
      console.log('⚠️ Archive system integrity issues found:', issues);
    }

    return { isValid, issues };

  } catch (error) {
    const errorMsg = `Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    issues.push(errorMsg);
    console.error('❌', errorMsg);
    return { isValid: false, issues };
  }
}

/**
 * Get archive system statistics
 */
export async function getArchiveStatistics(): Promise<{
  totalBids: number;
  archivedBids: number;
  activeBids: number;
  archiveDays: number;
  earliestArchive: string;
  latestArchive: string;
}> {
  try {
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM telegram_bids) as total_bids,
        (SELECT COUNT(*) FROM telegram_bids WHERE is_archived = true) as archived_bids,
        (SELECT COUNT(*) FROM telegram_bids WHERE is_archived = false) as active_bids,
        (SELECT COUNT(DISTINCT archived_at::date) FROM archived_bids_with_metadata) as archive_days,
        (SELECT MIN(archived_at) FROM archived_bids_with_metadata) as earliest_archive,
        (SELECT MAX(archived_at) FROM archived_bids_with_metadata) as latest_archive
    `;

    return {
      totalBids: parseInt(stats[0].total_bids),
      archivedBids: parseInt(stats[0].archived_bids),
      activeBids: parseInt(stats[0].active_bids),
      archiveDays: parseInt(stats[0].archive_days),
      earliestArchive: stats[0].earliest_archive,
      latestArchive: stats[0].latest_archive
    };

  } catch (error) {
    console.error('❌ Failed to get archive statistics:', error);
    return {
      totalBids: 0,
      archivedBids: 0,
      activeBids: 0,
      archiveDays: 0,
      earliestArchive: '',
      latestArchive: ''
    };
  }
}

/**
 * Clean up old archive tables that are no longer needed
 * This should be run after confirming the new system is working
 */
export async function cleanupOldArchiveTables(): Promise<{
  cleaned: string[];
  errors: string[];
}> {
  const cleaned: string[] = [];
  const errors: string[] = [];

  try {
    console.log('🧹 Cleaning up old archive tables...');

    // Drop archive_bids table (empty table)
    try {
      await sql`DROP TABLE IF EXISTS archive_bids`;
      cleaned.push('archive_bids');
      console.log('✅ Dropped archive_bids table');
    } catch (error) {
      errors.push(`Failed to drop archive_bids: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Drop active_telegram_bids table (empty table)
    try {
      await sql`DROP TABLE IF EXISTS active_telegram_bids`;
      cleaned.push('active_telegram_bids');
      console.log('✅ Dropped active_telegram_bids table');
    } catch (error) {
      errors.push(`Failed to drop active_telegram_bids: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(`✅ Cleanup completed. Cleaned: ${cleaned.length}, Errors: ${errors.length}`);

  } catch (error) {
    const errorMsg = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('❌', errorMsg);
  }

  return { cleaned, errors };
}
