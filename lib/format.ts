/**
 * Formatting utilities for money, timestamps, and other display values
 */

// Money formatting
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyCompact(cents: number): string {
  if (cents >= 100000) {
    return `$${(cents / 100000).toFixed(1)}k`;
  }
  return formatMoney(cents);
}

export function parseMoneyToCents(value: string | number): number {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }
  
  // Remove currency symbols and parse
  const cleaned = value.replace(/[$,]/g, '');
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed) || parsed < 0) {
    throw new Error('Invalid money amount');
  }
  
  return Math.round(parsed * 100);
}

// Distance formatting
export function formatDistance(miles: number | null): string {
  if (!miles) return 'N/A';
  return `${miles.toLocaleString()} mi`;
}

export function formatMiles(miles: number | null): string {
  if (!miles) return 'N/A';
  return `${miles.toLocaleString()} mi`;
}

// Timestamp formatting - system timezone (CST)
export function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago', // CST
  }).format(date);
}

export function formatTimeOnly(timestamp: string | Date): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago', // CST
  }).format(date);
}

export function formatRelativeTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatTimestamp(timestamp);
}

// Countdown formatting
export function formatCountdown(expiresAt: string | Date): {
  timeLeft: string;
  isExpired: boolean;
  secondsLeft: number;
} {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  const secondsLeft = Math.max(0, Math.floor(diffMs / 1000));
  const isExpired = secondsLeft === 0;

  if (isExpired) {
    return {
      timeLeft: '00:00',
      isExpired: true,
      secondsLeft: 0,
    };
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  
  return {
    timeLeft: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
    isExpired: false,
    secondsLeft,
  };
}

// Stops formatting
export function formatStops(stops: string[] | null): string {
  if (!stops || stops.length === 0) return 'N/A';
  if (stops.length === 1) return stops[0];
  if (stops.length === 2) return `${stops[0]} → ${stops[1]}`;
  return `${stops[0]} → ... → ${stops[stops.length - 1]}`;
}

// Pickup date/time formatting - display times as stored in database (already in local timezone)
export function formatPickupDateTime(timestamp: string | null): string {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return 'N/A';
  
  // Format without timezone conversion since database already stores times in local timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    // No timeZone specified - use the timezone already in the timestamp
  });
  
  const parts = formatter.formatToParts(date);
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  const year = parts.find(part => part.type === 'year')?.value;
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  const dayPeriod = parts.find(part => part.type === 'dayPeriod')?.value;
  
  return `${month}/${day}/${year} ${hour}:${minute} ${dayPeriod}`;
}

// Stop count formatting - pickup doesn't count as a stop
export function formatStopCount(stops: string[] | null): string {
  if (!stops || stops.length === 0) return '0 stops';
  // Subtract 1 because pickup location doesn't count as a stop
  const actualStops = Math.max(0, stops.length - 1);
  if (actualStops === 0) return '0 stops';
  if (actualStops === 1) return '1 stop';
  return `${actualStops} stops`;
}

// Detailed stops formatting for view details
export function formatStopsDetailed(stops: string[] | null): string[] {
  if (!stops || stops.length === 0) return ['No stops available'];
  return stops;
}

// Validation helpers
export function validateMoneyInput(value: string): {
  isValid: boolean;
  error?: string;
  cents?: number;
} {
  try {
    const cents = parseMoneyToCents(value);
    
    if (cents <= 0) {
      return { isValid: false, error: 'Amount must be greater than $0' };
    }
    
    if (cents > 10000000) { // $100,000
      return { isValid: false, error: 'Amount cannot exceed $100,000' };
    }
    
    return { isValid: true, cents };
  } catch {
    return { isValid: false, error: 'Invalid amount format' };
  }
}

// Phone number formatting
export function formatPhone(phone: string | null): string {
  if (!phone) return 'N/A';
  
  // Basic US phone number formatting
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

// MC Number formatting
export function formatMCNumber(mcNumber: string | null): string {
  if (!mcNumber) return 'N/A';
  return `MC${mcNumber}`;
}

// Legacy function aliases for backward compatibility
export const fmtUSD = formatMoney;
export const fmtMiles = formatMiles;
export const fmtDate = formatTimestamp;