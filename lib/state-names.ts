// US State Code to Full Name Mapping
export const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'DC': 'District of Columbia',
};

/**
 * Get full state name from state code
 */
export function getStateName(stateCode: string | null | undefined): string {
  if (!stateCode) return 'Unknown';
  const code = stateCode.toUpperCase().trim();
  return STATE_NAMES[code] || stateCode;
}

/**
 * Extract state code from various formats
 */
export function extractStateCode(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.trim().toUpperCase();
  
  const validStates = new Set(Object.keys(STATE_NAMES));
  
  // Try pattern: ", ST" or ",ST" at the end
  let match = trimmed.match(/,\s*([A-Z]{2})$/);
  if (match && validStates.has(match[1])) return match[1];
  
  // Try pattern: " ST" at the end
  match = trimmed.match(/\s+([A-Z]{2})$/);
  if (match && validStates.has(match[1])) return match[1];
  
  // Try to find any 2-letter uppercase code at the end
  match = trimmed.match(/([A-Z]{2})$/);
  if (match && validStates.has(match[1])) return match[1];
  
  return null;
}

