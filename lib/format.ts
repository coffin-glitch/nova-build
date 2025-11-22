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
  
  // Format each stop as "City, State ZIP" for card display
  const formatted = stops.map(stop => formatAddressForCard(stop));
  
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} → ${formatted[1]}`;
  return `${formatted[0]} → ... → ${formatted[formatted.length - 1]}`;
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
export function formatStopsDetailed(stops: string[] | null): ParsedAddress[] {
  if (!stops || stops.length === 0) return [];
  return stops.map(stop => parseAddress(stop));
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

// Address parsing and formatting
export interface ParsedAddress {
  streetNumber?: string;
  streetName?: string;
  city: string;
  state: string;
  zipcode?: string;
  country?: string; // Usually "USA"
  fullAddress: string; // Original string
}

/**
 * List of unit/suite identifiers that should be stripped from city names
 * These are always part of the street address, not the city name
 */
const UNIT_IDENTIFIERS = new Set([
  'RM', 'ROOM', 'STE', 'SUITE', 'APT', 'APARTMENT', 'UNIT', 'BLDG', 'BUILDING',
  'FL', 'FLOOR', 'LVL', 'LEVEL', 'BSMT', 'BASEMENT',
  'LOT', 'TRLR', 'TRAILER', 'SPC', 'SPACE', 'DOCK', 'BAY',
]);

/**
 * List of standalone directional prefixes (abbreviated only)
 * These are street directions, not city name prefixes
 * Note: Full words like "NORTH", "SOUTH" can be part of city names (e.g., "NORTH HOUSTON")
 */
const DIRECTIONAL_PREFIXES = new Set([
  'NW', 'NE', 'SW', 'SE', 'N', 'S', 'E', 'W',
]);

/**
 * Clean city name by removing street prefixes
 * Examples:
 * - "NW HURON" → "HURON" (NW is a directional prefix)
 * - "RM 114 AKRON" → "AKRON" (RM 114 is a unit identifier)
 * - "STE 400 OMAHA" → "OMAHA" (STE 400 is a unit identifier)
 * - "STE 101 GREENSBORO" → "GREENSBORO" (STE 101 is a unit identifier)
 * - "RM 224 NORTH HOUSTON" → "NORTH HOUSTON" (RM 224 is stripped, but NORTH stays as it's part of city name)
 * - "NORTH HOUSTON" → "NORTH HOUSTON" (stays as is - NORTH is part of city name)
 */
function cleanCityName(cityCandidate: string): string {
  if (!cityCandidate || typeof cityCandidate !== 'string') {
    return cityCandidate || '';
  }
  
  let cleaned = cityCandidate.trim();
  
  // Step 1: Remove numbered unit/suite prefixes like "RM 114", "STE 400", "APT 101", etc.
  // Pattern: (RM|STE|APT|UNIT|ROOM|SUITE) followed by optional number and space
  cleaned = cleaned.replace(/^(RM|ROOM|STE|SUITE|APT|APARTMENT|UNIT|BLDG|BUILDING|FL|FLOOR|LVL|LEVEL|BSMT|BASEMENT|LOT|TRLR|TRAILER|SPC|SPACE|DOCK|BAY)\s*\d*\s*/i, '');
  
  // Step 2: Remove standalone abbreviated directional prefixes (NW, NE, SW, SE, N, S, E, W)
  // Only remove if they're at the very start and are clearly standalone (not part of a city name)
  // Full words like "NORTH", "SOUTH" are kept as they can be part of city names
  const words = cleaned.split(/\s+/);
  if (words.length > 0) {
    const firstWord = words[0].toUpperCase();
    // Only remove if it's an abbreviated directional (not a full word)
    if (DIRECTIONAL_PREFIXES.has(firstWord) && firstWord.length <= 2) {
      // Remove the first word if it's a short directional prefix
      words.shift();
      cleaned = words.join(' ');
    }
  }
  
  // Step 3: Also handle case where directional might be separate (extra safety)
  // Only match abbreviated directions at the start
  cleaned = cleaned.replace(/^(NW|NE|SW|SE|N|S|E|W)\s+/i, '');
  
  return cleaned.trim();
}

/**
 * Parse full address string into structured components
 * Handles formats like:
 * - "7001 S CENTRAL AVE LOS ANGELES, CA, USA 90052" (street + city, state, country zip)
 * - "123 Main St, Atlanta, GA 30309, USA" (street, city, state zip, country)
 * - "456 Oak Ave, Dallas, TX 75201" (street, city, state zip)
 * - "Atlanta, GA 30309" (city, state zip)
 * - "Atlanta, GA" (city, state)
 */
export function parseAddress(addressString: string): ParsedAddress {
  if (!addressString || typeof addressString !== 'string') {
    return {
      city: '',
      state: '',
      fullAddress: addressString || ''
    };
  }

  const trimmed = addressString.trim();
  
  // List of valid US state abbreviations for validation
  const validStates = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]);
  
  // Pattern 1: "Street City, State, Country ZIP"
  // e.g., "7001 S CENTRAL AVE LOS ANGELES, CA, USA 90052"
  // Format: NUMBER STREET_NAME CITY_NAME, STATE, COUNTRY ZIP
  // Strategy: Find state and zip first, then work backwards to separate street from city
  const stateZipMatch = trimmed.match(/,\s*([A-Z]{2}),\s*([A-Z]+)\s+(\d{5}(?:-\d{4})?)$/i);
  if (stateZipMatch) {
    const [fullMatch, state, country, zipcode] = stateZipMatch;
    if (validStates.has(state.toUpperCase())) {
      // Everything before the state comma is street + city
      const beforeState = trimmed.substring(0, trimmed.indexOf(fullMatch)).trim();
      
      // Common street suffixes to help identify where street ends and city begins
      const streetSuffixes = ['AVE', 'ST', 'STREET', 'RD', 'ROAD', 'BLVD', 'BOULEVARD', 'DR', 'DRIVE', 
                              'LN', 'LANE', 'CT', 'COURT', 'CIR', 'CIRCLE', 'PKWY', 'PARKWAY', 'HWY', 'HIGHWAY',
                              'PL', 'PLACE', 'TER', 'TERRACE', 'WAY', 'SQ', 'SQUARE'];
      
      // Try to find where the street ends by looking for street suffixes
      // Pattern: NUMBER DIRECTION? STREET_NAME STREET_SUFFIX CITY_NAME
      let streetEndIndex = -1;
      let cityStartIndex = -1;
      
      for (const suffix of streetSuffixes) {
        const suffixRegex = new RegExp(`\\s+${suffix}\\s+`, 'i');
        const suffixMatch = beforeState.match(suffixRegex);
        if (suffixMatch && suffixMatch.index !== undefined) {
          streetEndIndex = suffixMatch.index + suffixMatch[0].length;
          cityStartIndex = streetEndIndex;
          break;
        }
      }
      
      if (streetEndIndex > 0 && cityStartIndex > 0) {
        // Found street suffix - separate at that point
        const streetPart = beforeState.substring(0, streetEndIndex).trim();
        let city = beforeState.substring(cityStartIndex).trim();
        
        // Clean city name to remove street prefixes
        city = cleanCityName(city);
        
        const streetNumMatch = streetPart.match(/^(\d+)\s+(.+)$/);
        
        return {
          streetNumber: streetNumMatch ? streetNumMatch[1] : undefined,
          streetName: streetNumMatch ? streetNumMatch[2].trim() : streetPart,
          city: city,
          state: state.toUpperCase(),
          zipcode: zipcode,
          country: country || 'USA',
          fullAddress: trimmed
        };
      }
      
      // Fallback: Try to identify city by common patterns
      // Cities are usually 1-3 words, often all caps
      // Look for pattern: ... CITY_NAME (where city name is 1-3 uppercase words before the comma)
      // Split by spaces and work backwards from the comma
      const beforeStateWords = beforeState.split(/\s+/);
      if (beforeStateWords.length >= 3) {
        // Try last 1-3 words as city (common city name lengths)
        for (let cityWords = 1; cityWords <= 3 && cityWords < beforeStateWords.length; cityWords++) {
          let cityCandidate = beforeStateWords.slice(-cityWords).join(' ');
          // Check if it looks like a city name (all caps, 2+ chars per word)
          if (cityCandidate.match(/^[A-Z\s]{4,}$/i) && cityCandidate.split(/\s+/).every(w => w.length >= 2)) {
            // Clean city name to remove street prefixes
            cityCandidate = cleanCityName(cityCandidate);
            
            const streetPart = beforeStateWords.slice(0, -cityWords).join(' ');
            const streetNumMatch = streetPart.match(/^(\d+)\s+(.+)$/);
            
            return {
              streetNumber: streetNumMatch ? streetNumMatch[1] : undefined,
              streetName: streetNumMatch ? streetNumMatch[2].trim() : streetPart,
              city: cityCandidate.trim(),
              state: state.toUpperCase(),
              zipcode: zipcode,
              country: country || 'USA',
              fullAddress: trimmed
            };
          }
        }
      }
      
      // Last resort: if we can't separate, try to extract street number
      const streetNumMatch = beforeState.match(/^(\d+)\s+(.+)$/);
      if (streetNumMatch) {
        // Assume the last word or two words before comma might be city
        const remaining = streetNumMatch[2].trim();
        const remainingWords = remaining.split(/\s+/);
        if (remainingWords.length >= 2) {
          let city = remainingWords.slice(-2).join(' '); // Last 2 words as city
          // Clean city name to remove street prefixes
          city = cleanCityName(city);
          const streetName = remainingWords.slice(0, -2).join(' ');
          return {
            streetNumber: streetNumMatch[1],
            streetName: streetName,
            city: city,
            state: state.toUpperCase(),
            zipcode: zipcode,
            country: country || 'USA',
            fullAddress: trimmed
          };
        }
        // If only one word remains after street number, it's probably the street name
        // and the city might be missing or combined - try to extract city from the end
        if (remainingWords.length === 1) {
          // Single word - might be street name, city might be missing
          // Try to find city by looking for common city patterns in the full string
          // For now, use the last word as potential city (after cleaning)
          let city = cleanCityName(remaining);
          return {
            streetNumber: streetNumMatch[1],
            streetName: remaining,
            city: city,
            state: state.toUpperCase(),
            zipcode: zipcode,
            country: country || 'USA',
            fullAddress: trimmed
          };
        }
      }
      
      // Absolute last resort: if we have state and zip, at least extract those
      // Try to find city by taking last 1-3 words before the comma (cities are usually 1-3 words)
      const lastResortWords = beforeState.split(/\s+/);
      let extractedCity = '';
      let extractedStreetNumber: string | undefined;
      let extractedStreetName: string | undefined;
      
      if (lastResortWords.length >= 2) {
        // Try last 1-3 words as city (prioritize longer city names)
        for (let cityWords = 3; cityWords >= 1 && cityWords <= lastResortWords.length; cityWords--) {
          let cityCandidate = lastResortWords.slice(-cityWords).join(' ');
          // City should be at least 2 characters and not contain numbers (usually)
          if (cityCandidate.length >= 2 && !cityCandidate.match(/^\d/)) {
            // Clean city name to remove street prefixes
            cityCandidate = cleanCityName(cityCandidate);
            extractedCity = cityCandidate;
            const streetPart = lastResortWords.slice(0, -cityWords).join(' ');
            if (streetPart) {
              const streetMatch = streetPart.match(/^(\d+)\s+(.+)$/);
              if (streetMatch) {
                extractedStreetNumber = streetMatch[1];
                extractedStreetName = streetMatch[2].trim();
              } else {
                extractedStreetName = streetPart;
              }
            }
            break;
          }
        }
        
        // If we still don't have a city, use the last word as city (after cleaning)
        if (!extractedCity && lastResortWords.length > 0) {
          extractedCity = cleanCityName(lastResortWords[lastResortWords.length - 1]);
          const streetPart = lastResortWords.slice(0, -1).join(' ');
          const streetMatch = streetPart.match(/^(\d+)\s+(.+)$/);
          if (streetMatch) {
            extractedStreetNumber = streetMatch[1];
            extractedStreetName = streetMatch[2].trim();
          } else {
            extractedStreetName = streetPart;
          }
        }
      } else if (lastResortWords.length === 1) {
        // Single word - check if it's a number (street) or text (city)
        const word = lastResortWords[0];
        if (word.match(/^\d/)) {
          // Starts with number - probably street number only
          extractedStreetNumber = word;
          extractedCity = ''; // No city extracted
        } else {
          // Text - probably city (clean it)
          extractedCity = cleanCityName(word);
        }
      }
      
      // If we still don't have a city, we can't parse it properly
      // But we still have state and zip, so return what we have
      // Clean the fallback city name too
      const fallbackCity = extractedCity || cleanCityName(beforeState);
      return {
        streetNumber: extractedStreetNumber,
        streetName: extractedStreetName,
        city: fallbackCity,
        state: state.toUpperCase(),
        zipcode: zipcode,
        country: country || 'USA',
        fullAddress: trimmed
      };
    }
  }

  // Pattern 3: "Street, City, State ZIP, Country"
  // e.g., "123 Main St, Atlanta, GA 30309, USA"
  let match = trimmed.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:,\s*(.+))?$/i);
  if (match) {
    const [, street, city, state, zipcode, country] = match;
    if (validStates.has(state.toUpperCase())) {
      const streetMatch = street.match(/^(\d+)\s+(.+)$/);
      return {
        streetNumber: streetMatch ? streetMatch[1] : undefined,
        streetName: streetMatch ? streetMatch[2] : street,
        city: city.trim(),
        state: state.toUpperCase(),
        zipcode: zipcode,
        country: country || 'USA',
        fullAddress: trimmed
      };
    }
  }

  // Pattern 4: "Street, City, State ZIP"
  // e.g., "123 Main St, Atlanta, GA 30309"
  match = trimmed.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (match) {
    const [, street, city, state, zipcode] = match;
    if (validStates.has(state.toUpperCase())) {
      const streetMatch = street.match(/^(\d+)\s+(.+)$/);
      return {
        streetNumber: streetMatch ? streetMatch[1] : undefined,
        streetName: streetMatch ? streetMatch[2] : street,
        city: city.trim(),
        state: state.toUpperCase(),
        zipcode: zipcode,
        country: 'USA',
        fullAddress: trimmed
      };
    }
  }

  // Pattern 5: "City, State ZIP" (no street)
  // e.g., "Atlanta, GA 30309"
  match = trimmed.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (match) {
    const [, city, state, zipcode] = match;
    if (validStates.has(state.toUpperCase())) {
      return {
        city: city.trim(),
        state: state.toUpperCase(),
        zipcode: zipcode,
        country: 'USA',
        fullAddress: trimmed
      };
    }
  }

  // Pattern 6: "City, State" (no zip)
  // e.g., "Atlanta, GA"
  match = trimmed.match(/^(.+?),\s*([A-Z]{2})$/i);
  if (match) {
    const [, city, state] = match;
    if (validStates.has(state.toUpperCase())) {
      return {
        city: city.trim(),
        state: state.toUpperCase(),
        country: 'USA',
        fullAddress: trimmed
      };
    }
  }

  // Fallback: Try to extract city and state from comma-separated format
  // Look for pattern: "... CITY, STATE ..." or "... CITY, STATE, ..."
  const parts = trimmed.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // Try to find state in the parts
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      // Check if this part is a state code (might be "STATE" or "STATE ZIP" or "STATE, COUNTRY ZIP")
      const stateMatch = part.match(/^([A-Z]{2})(?:\s|,|$)/i);
      if (stateMatch && validStates.has(stateMatch[1].toUpperCase())) {
        const state = stateMatch[1].toUpperCase();
        // Try to extract zipcode from this part or next part
        const zipMatch = part.match(/\s+(\d{5}(?:-\d{4})?)$/);
        const zipcode = zipMatch ? zipMatch[1] : (parts[i + 1]?.match(/^(\d{5}(?:-\d{4})?)$/)?.[1]);
        
        // City is the part before the state
        let city = parts[i - 1].trim();
        
        // Clean city name to remove street prefixes
        city = cleanCityName(city);
        
        // If city contains street (starts with number), try to extract just city name
        if (city.match(/^\d+\s/)) {
          // City part includes street - try to extract city name
          // Look for common patterns: NUMBER STREET CITY or STREET CITY
          const cityWords = city.split(/\s+/);
          // Cities are usually 1-3 words at the end
          if (cityWords.length > 2) {
            // Try last 1-3 words as city
            for (let cityWordCount = 3; cityWordCount >= 1; cityWordCount--) {
              if (cityWords.length >= cityWordCount) {
                let cityCandidate = cityWords.slice(-cityWordCount).join(' ');
                // Clean again to ensure no prefixes
                cityCandidate = cleanCityName(cityCandidate);
                // Check if it looks like a city (not a number, not a street type)
                if (!cityCandidate.match(/^\d/) && !cityCandidate.match(/\b(AVE|ST|STREET|RD|ROAD|BLVD|DR|DRIVE)\b/i)) {
                  city = cityCandidate;
                  break;
                }
              }
            }
          }
        }
        
        // Street is everything before the city in the first part
        let streetNumber: string | undefined;
        let streetName: string | undefined;
        if (i > 1) {
          const streetPart = parts.slice(0, i - 1).join(' ');
          const streetMatch = streetPart.match(/^(\d+)\s+(.+)$/);
          if (streetMatch) {
            streetNumber = streetMatch[1];
            streetName = streetMatch[2].trim();
          } else {
            streetName = streetPart;
          }
        } else if (i === 1) {
          // City might include street - try to extract
          const cityPart = parts[0];
          const streetMatch = cityPart.match(/^(\d+)\s+(.+?)\s+([A-Z][A-Z\s]{2,})$/i);
          if (streetMatch) {
            streetNumber = streetMatch[1];
            streetName = streetMatch[2].trim();
            // City is the last part
            city = streetMatch[3].trim();
          }
        }
        
        return {
          streetNumber,
          streetName,
          city: city,
          state: state,
          zipcode: zipcode,
          country: 'USA',
          fullAddress: trimmed
        };
      }
    }
  }

  // Last resort: return as-is (but try to extract state if possible)
  const lastResortStateMatch = trimmed.match(/,\s*([A-Z]{2})(?:\s|,|$)/i);
  if (lastResortStateMatch && validStates.has(lastResortStateMatch[1].toUpperCase())) {
    return {
      city: trimmed.split(',')[0]?.trim() || trimmed,
      state: lastResortStateMatch[1].toUpperCase(),
      fullAddress: trimmed
    };
  }
  
  return {
    city: trimmed,
    state: '',
    fullAddress: trimmed
  };
}

/**
 * Extract city and state from address string (for matching)
 * Returns normalized format: { city, state }
 */
export function extractCityStateForMatching(addressString: string): { city: string; state: string } | null {
  const parsed = parseAddress(addressString);
  if (parsed.city && parsed.state) {
    return {
      city: parsed.city.trim(),
      state: parsed.state.toUpperCase()
    };
  }
  return null;
}

/**
 * Compare two addresses by city and state only
 * Returns true if cities and states match (case-insensitive)
 */
export function compareAddressesByCityState(address1: string, address2: string): boolean {
  const cityState1 = extractCityStateForMatching(address1);
  const cityState2 = extractCityStateForMatching(address2);
  
  if (!cityState1 || !cityState2) return false;
  
  return (
    cityState1.city.toUpperCase().trim() === cityState2.city.toUpperCase().trim() &&
    cityState1.state === cityState2.state
  );
}

/**
 * Format address for card display: "City, State ZIP"
 */
export function formatAddressForCard(address: string | ParsedAddress): string {
  const parsed = typeof address === 'string' ? parseAddress(address) : address;
  
  // If we don't have city or state, try to extract from full address
  if (!parsed.city || !parsed.state) {
    // Last resort: try to extract city and state from full address string
    const trimmed = parsed.fullAddress.trim();
    const stateMatch = trimmed.match(/,\s*([A-Z]{2})(?:,|\s|$)/i);
    if (stateMatch) {
      const state = stateMatch[1].toUpperCase();
      // Try to find city before the state
      const beforeState = trimmed.substring(0, trimmed.indexOf(stateMatch[0])).trim();
      // Take last 1-3 words as potential city
      const words = beforeState.split(/\s+/);
      if (words.length > 0) {
        const city = words.slice(-Math.min(3, words.length)).join(' ');
        if (parsed.zipcode) {
          return `${city}, ${state} ${parsed.zipcode}`;
        }
        return `${city}, ${state}`;
      }
    }
    return parsed.fullAddress; // Absolute fallback to full address
  }
  
  // Validate that city doesn't contain the full address (parsing might have failed)
  // If city is too long, contains street numbers, or contains zip codes, it might include the street
  if (parsed.city.length > 40 || parsed.city.match(/^\d+\s/) || parsed.city.match(/\d{5}/)) {
    // City looks suspicious - try to extract just the city name
    const words = parsed.city.split(/\s+/);
    if (words.length > 2) {
      // Probably includes street - take last 1-3 words as city (cities are usually 1-3 words)
      // Skip words that look like street parts (numbers, directions, street types)
      const streetIndicators = ['N', 'S', 'E', 'W', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'AVE', 'ST', 'STREET', 'RD', 'ROAD', 'BLVD', 'DR', 'DRIVE'];
      let cityWords: string[] = [];
      
      // Work backwards from the end, collecting city words
      for (let i = words.length - 1; i >= 0 && cityWords.length < 3; i--) {
        const word = words[i].toUpperCase();
        // Skip if it's a street indicator or starts with a number
        if (!streetIndicators.includes(word) && !word.match(/^\d/)) {
          cityWords.unshift(words[i]);
        } else {
          // If we hit a street indicator, we've probably found the end of the city
          break;
        }
      }
      
      if (cityWords.length > 0) {
        const cityOnly = cityWords.join(' ');
        if (parsed.zipcode) {
          return `${cityOnly}, ${parsed.state} ${parsed.zipcode}`;
        }
        return `${cityOnly}, ${parsed.state}`;
      }
      
      // Fallback: just take last 1-2 words
      const cityOnly = words.slice(-Math.min(2, words.length)).join(' ');
      if (parsed.zipcode) {
        return `${cityOnly}, ${parsed.state} ${parsed.zipcode}`;
      }
      return `${cityOnly}, ${parsed.state}`;
    }
  }
  
  if (parsed.zipcode) {
    return `${parsed.city}, ${parsed.state} ${parsed.zipcode}`;
  }
  
  return `${parsed.city}, ${parsed.state}`;
}

/**
 * Format address for details view: Full address with all components
 */
export function formatAddressForDetails(address: string | ParsedAddress): string {
  const parsed = typeof address === 'string' ? parseAddress(address) : address;
  return parsed.fullAddress;
}