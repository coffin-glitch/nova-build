/**
 * Timezone utility functions
 * Converts UTC timestamps to user's local timezone for display
 */

/**
 * Converts UTC timestamp to user's local timezone
 * Preserves UTC in database, converts only for display
 */
export function toLocalTime(utcTimestamp: string | Date, options?: {
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
  hour12?: boolean;
  showSeconds?: boolean;
}): string {
  const date = new Date(utcTimestamp);
  
  // Default to user's browser timezone
  const formatted = date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: options?.showSeconds ? '2-digit' : undefined,
    hour12: options?.hour12 ?? false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  
  return formatted;
}

/**
 * Converts UTC date to user's local date only
 */
export function toLocalDate(utcTimestamp: string | Date): string {
  const date = new Date(utcTimestamp);
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}

/**
 * Converts UTC time to user's local time only
 */
export function toLocalTimeOnly(utcTimestamp: string | Date, showSeconds = false): string {
  const date = new Date(utcTimestamp);
  
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}

/**
 * Formats archive date consistently
 * Shows archived_at in local timezone
 */
export function formatArchiveDate(archivedAt: string | null | undefined): string {
  if (!archivedAt) return 'Not archived';
  
  const date = new Date(archivedAt);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}

/**
 * Gets user's timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Checks if dates are on the same day in local timezone
 */
export function isSameLocalDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  const localD1 = d1.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  
  const localD2 = d2.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  
  return localD1 === localD2;
}

/**
 * Groups bids by local date (for archive timeline)
 */
export function groupByLocalDate<T extends { archived_at: string | null; received_at: string }>(
  bids: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  
  bids.forEach(bid => {
    // Use archived_at if available, otherwise received_at
    const dateToUse = bid.archived_at || bid.received_at;
    const date = new Date(dateToUse);
    
    // Get date in user's local timezone
    const localDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    if (!grouped[localDate]) {
      grouped[localDate] = [];
    }
    grouped[localDate].push(bid);
  });
  
  return grouped;
}

