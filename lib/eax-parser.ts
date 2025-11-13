/**
 * EAX Data Parser
 * Handles parsing and organizing EAX CSV/Excel data into a standardized format
 */

export interface EAXLoadData {
  // Core identifiers
  rr_number: string;
  tm_number?: string;
  load_number?: string;
  status_code?: string;
  
  // Route information
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  
  // Timing
  pickup_date?: string;
  pickup_time?: string;
  pickup_window?: string;
  delivery_date?: string;
  delivery_time?: string;
  delivery_window?: string;
  
  // Load specifications
  equipment: string;
  weight?: number;
  commodity?: string;
  stops?: number;
  miles?: number;
  
  // Financial
  revenue?: number;
  purchase?: number;
  net?: number;
  margin?: number;
  rate_cents?: number;
  target_buy?: number;
  max_buy?: number;
  purch_tr?: number;
  net_mrg?: number;
  cm?: number;
  fuel_surcharge?: number;
  
  // Contact information
  customer_name?: string;
  customer_ref?: string;
  driver_name?: string;
  dispatcher_name?: string;
  vendor_name?: string;
  vendor_dispatch?: string;
  
  // Additional EAX fields
  spot_bid?: string;
  docs_scanned?: string;
  invoice_date?: string;
  invoice_audit?: string;
  nbr_of_stops?: number;
  
  // Additional data
  notes?: string;
  archived?: boolean;
  raw_data?: any;
}

export interface EAXCSVHeaders {
  rr_number: number;
  load_number: number;
  tm_number: number;
  status: number;
  pickup_date: number;
  pickup_time: number;
  delivery_date: number;
  delivery_time: number;
  dispatcher: number;
  invoice_date: number;
  docs_scanned: number;
  invoice_audit: number;
  revenue: number;
  purch_tr: number;
  target_buy: number;
  max_buy: number;
  net_mrg: number;
  cm: number;
  nbr_of_stops: number;
  weight: number;
  equipment: number;
  customer_name: number;
  customer_ref: number;
  spot_bid: number;
  driver: number;
  miles: number;
  fuel_surcharge: number;
  origin: number;
  destination: number;
  vendor_dispatch: number;
}

/**
 * Adjust time ranges for USPS loads (e.g., 1200-1300)
 */
function adjustTimeRange(timeValue: string): string {
  if (!timeValue) return timeValue;
  
  // Check if it's a range format like 1200-1300
  const rangeMatch = timeValue.match(/^(\d{3,4})-(\d{3,4})$/);
  if (rangeMatch) {
    const [, startTime, endTime] = rangeMatch;
    // Return the start time in 24-hour format
    return formatMilitaryTime(startTime);
  }
  
  return formatMilitaryTime(timeValue);
}

/**
 * Format time to 24-hour military format
 */
function formatMilitaryTime(timeValue: string): string {
  if (!timeValue) return timeValue;
  
  // Remove any non-digit characters
  const cleanTime = timeValue.replace(/\D/g, '');
  
  // Handle 3-digit times (e.g., 800 -> 0800)
  if (cleanTime.length === 3) {
    return `0${cleanTime}`;
  }
  
  // Handle 4-digit times (e.g., 1200 -> 1200)
  if (cleanTime.length === 4) {
    return cleanTime;
  }
  
  return timeValue;
}

/**
 * Apply stops modification logic for all loads
 */
function modifyStops(stopsValue: string | number): number {
  if (!stopsValue) return 1; // Default to 1 stop
  
  const stops = typeof stopsValue === 'string' ? parseInt(stopsValue) : stopsValue;
  
  // Apply stops modification logic
  if (stops <= 0) return 1;
  if (stops > 10) return 10; // Cap at 10 stops
  
  return stops;
}

/**
 * Parse date from EAX CSV format (MM/DD/YY or MM/DD/YYYY)
 */
function parseEAXDate(dateValue: string): string | undefined {
  if (!dateValue || dateValue.trim() === '') return undefined;
  
  const trimmed = dateValue.trim();
  
  // Handle MM/DD/YY format
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('/');
    const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return trimmed; // Return original format for now
    }
  }
  
  // Handle MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return trimmed; // Return original format for now
    }
  }
  
  // Try parsing as a general date
  const date = new Date(trimmed);
  if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
    return trimmed;
  }
  
  return undefined;
}

/**
 * Check if a value is a valid date (not a time or currency)
 */
function isValidDate(value: string): boolean {
  if (!value || value.trim() === '') return false;
  
  const trimmed = value.trim();
  
  // Check if it's a time format (HHMM, HH:MM, etc.)
  if (/^\d{3,4}$/.test(trimmed) || /^\d{1,2}:\d{2}$/.test(trimmed)) {
    return false;
  }
  
  // Check if it's a currency format
  if (/^\$?[\d,]+\.?\d*$/.test(trimmed)) {
    return false;
  }
  
  // Check for MM/DD/YY format specifically (common in EAX files)
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('/');
    const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
  }
  
  // Check for MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
  }
  
  // Check if it's a valid date
  const date = new Date(trimmed);
  return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
}

/**
 * Smart CSV parser that handles quoted values and commas within quotes
 */
export function parseCSVLine(line: string): string[] {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last value
  values.push(current.trim());
  
  return values;
}

/**
 * Detect EAX CSV headers and map them to our standard format
 * Uses intelligent pattern matching to handle various EAX formats
 */
export function detectEAXHeaders(headers: string[]): Partial<EAXCSVHeaders> {
  const headerMap: Partial<EAXCSVHeaders> = {};
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    
    // Exact matching for the specific EAX format from RRBLOD02R.csv
    // Headers: "RR#","Load#","Tm#","Sts","Pickup Date","Pickup Time","Delivery Date","Delivery Time","Dispatcher","Invoice Date","Docs Scanned","Invoice Audit","Revenue$","Purch Tr$","Target Buy","Max Buy","Net Mrg$","CM$","Nbr of Stops","Weight","Equipment","Cust Name","Cust Ref#","Spot Bid","Driver","Tot Miles","Fuel Surcharge","Origin","Destination","Vendor Dispatch"
    
    if (normalizedHeader === 'rr' || normalizedHeader === 'rr number') {
      headerMap.rr_number = index;
    } else if (normalizedHeader === 'load' || normalizedHeader === 'load number') {
      headerMap.load_number = index;
    } else if (normalizedHeader === 'tm' || normalizedHeader === 'tm number') {
      headerMap.tm_number = index;
    } else if (normalizedHeader === 'sts' || normalizedHeader === 'status') {
      headerMap.status = index;
    } else if (normalizedHeader === 'pickup date') {
      headerMap.pickup_date = index;
    } else if (normalizedHeader === 'pickup time') {
      headerMap.pickup_time = index;
    } else if (normalizedHeader === 'delivery date') {
      headerMap.delivery_date = index;
    } else if (normalizedHeader === 'delivery time') {
      headerMap.delivery_time = index;
    } else if (normalizedHeader === 'dispatcher') {
      headerMap.dispatcher = index;
    } else if (normalizedHeader === 'invoice date') {
      headerMap.invoice_date = index;
    } else if (normalizedHeader === 'docs scanned') {
      headerMap.docs_scanned = index;
    } else if (normalizedHeader === 'invoice audit') {
      headerMap.invoice_audit = index;
    } else if (normalizedHeader === 'revenue' || normalizedHeader === 'revenue$') {
      headerMap.revenue = index;
    } else if (normalizedHeader === 'purch tr' || normalizedHeader === 'purch tr$') {
      headerMap.purch_tr = index;
    } else if (normalizedHeader === 'target buy') {
      headerMap.target_buy = index;
    } else if (normalizedHeader === 'max buy') {
      headerMap.max_buy = index;
    } else if (normalizedHeader === 'net mrg' || normalizedHeader === 'net mrg$') {
      headerMap.net_mrg = index;
    } else if (normalizedHeader === 'cm' || normalizedHeader === 'cm$') {
      headerMap.cm = index;
    } else if (normalizedHeader === 'nbr of stops') {
      headerMap.nbr_of_stops = index;
    } else if (normalizedHeader === 'weight') {
      headerMap.weight = index;
    } else if (normalizedHeader === 'equipment') {
      headerMap.equipment = index;
    } else if (normalizedHeader === 'cust name' || normalizedHeader === 'customer name') {
      headerMap.customer_name = index;
    } else if (normalizedHeader === 'cust ref' || normalizedHeader === 'cust ref#' || normalizedHeader === 'customer ref') {
      headerMap.customer_ref = index;
    } else if (normalizedHeader === 'spot bid') {
      headerMap.spot_bid = index;
    } else if (normalizedHeader === 'driver') {
      headerMap.driver = index;
    } else if (normalizedHeader === 'tot miles' || normalizedHeader === 'miles') {
      headerMap.miles = index;
    } else if (normalizedHeader === 'fuel surcharge') {
      headerMap.fuel_surcharge = index;
    } else if (normalizedHeader === 'origin') {
      headerMap.origin = index;
    } else if (normalizedHeader === 'destination') {
      headerMap.destination = index;
    } else if (normalizedHeader === 'vendor dispatch') {
      headerMap.vendor_dispatch = index;
    }
  });
  
  return headerMap;
}

/**
 * Intelligent equipment type mapping for EAX data
 * Handles various EAX equipment codes and maps them to standard types
 */
export function mapEquipmentType(equipmentCode: string): string {
  if (!equipmentCode) return 'Dry Van';
  
  const code = equipmentCode.toUpperCase().trim();
  
  // EAX equipment code mapping based on user specifications
  const equipmentMap: { [key: string]: string } = {
    'V': 'Dry Van',
    'VR': 'Dry Van or Reefer',
    'R': 'Reefer',
    'F': 'Flat Bed',
    'CN': 'Conestoga',
    'DT': 'Dump Trailer',
    'FT': 'Flat Bed w/ Tarps',
    'FD': 'Flat Bed or Step Deck',
    'FH': 'Flat Bed or HotShot',
    'HTSH': 'HotShot',
    'PO': 'Power Only',
    'SD': 'Step Deck',
    'VF': 'Dry Van or Refer',
    // Legacy mappings for backward compatibility
    'DRY VAN': 'Dry Van',
    'REEFER': 'Reefer',
    'FLATBED': 'Flat Bed',
    'CONTAINER': 'Container',
    'TANKER': 'Tanker',
    'VAN/REEFER': 'Dry Van or Reefer',
    'DRY': 'Dry Van',
    'REEF': 'Reefer',
    'FLAT': 'Flat Bed',
    'CONT': 'Container',
    'TANK': 'Tanker'
  };
  
  return equipmentMap[code] || equipmentCode;
}

/**
 * Parse a single EAX load row into standardized format
 */
export function parseEAXLoadRow(row: string[], headers: Partial<EAXCSVHeaders>): EAXLoadData {
  const getValue = (index?: number) => index !== undefined ? (row[index] || '').trim() : '';
  const getNumber = (index?: number) => {
    const value = getValue(index);
    return value ? parseFloat(value.replace(/[,$]/g, '')) : undefined;
  };
  const getInt = (index?: number) => {
    const value = getValue(index);
    return value ? parseInt(value.replace(/[,$]/g, '')) : undefined;
  };

  // Parse origin and destination
  const origin = getValue(headers.origin);
  const destination = getValue(headers.destination);
  
  const originParts = origin.split(',').map(p => p.trim());
  const destinationParts = destination.split(',').map(p => p.trim());
  
  const originCity = originParts[0] || 'Unknown';
  const originState = originParts[1] || 'Unknown';
  const destinationCity = destinationParts[0] || 'Unknown';
  const destinationState = destinationParts[1] || 'Unknown';

  // Parse dates and times with validation
  const pickupDateRaw = getValue(headers.pickup_date);
  const deliveryDateRaw = getValue(headers.delivery_date);
  const pickupTimeRaw = getValue(headers.pickup_time);
  const deliveryTimeRaw = getValue(headers.delivery_time);

  // Parse dates using the new EAX date parser
  const pickupDate = parseEAXDate(pickupDateRaw);
  const deliveryDate = parseEAXDate(deliveryDateRaw);

  // Parse financial data
  const revenue = getNumber(headers.revenue);
  const miles = getInt(headers.miles);
  const weightRaw = getNumber(headers.weight);
  const stopsRaw = getInt(headers.nbr_of_stops);
  const targetBuy = getNumber(headers.target_buy);
  const maxBuy = getNumber(headers.max_buy);
  const purchTr = getNumber(headers.purch_tr);
  const netMrg = getNumber(headers.net_mrg);
  const cm = getNumber(headers.cm);
  const fuelSurcharge = getNumber(headers.fuel_surcharge) || 0; // Default to 0

  // Parse equipment with intelligent mapping
  const equipmentCode = getValue(headers.equipment);
  const equipment = mapEquipmentType(equipmentCode);

  // Get customer name for special USPS logic
  const customerName = getValue(headers.customer_name);

  // Special logic for USPS loads
  let weight = weightRaw;
  let pickupTime = pickupTimeRaw;
  let deliveryTime = deliveryTimeRaw;
  let stops = stopsRaw;

  if (customerName && customerName.toLowerCase().includes('usps')) {
    // Set default weight to 30,000 lbs for USPS loads
    weight = weight || 30000;
    
    // Adjust time ranges for USPS loads
    pickupTime = adjustTimeRange(pickupTimeRaw);
    deliveryTime = adjustTimeRange(deliveryTimeRaw);
  } else {
    // Format times to military format for all loads
    pickupTime = formatMilitaryTime(pickupTimeRaw);
    deliveryTime = formatMilitaryTime(deliveryTimeRaw);
  }

  // Apply stops modification logic for all loads
  stops = modifyStops(stopsRaw ?? 1);

  // Calculate derived values
  const rateCents = revenue ? Math.round(revenue * 100) : undefined;

  // Debug logging for RR number
  const rrNumberRaw = getValue(headers.rr_number);
  console.log("Raw RR number:", rrNumberRaw, "Headers:", headers.rr_number);
  
  return {
    // Core identifiers
    rr_number: rrNumberRaw || `UNKNOWN_${Date.now()}`,
    tm_number: getValue(headers.tm_number),
    load_number: getValue(headers.load_number),
    status_code: getValue(headers.status),
    
    // Route information
    origin_city: originCity,
    origin_state: originState,
    destination_city: destinationCity,
    destination_state: destinationState,
    
    // Timing
    pickup_date: pickupDate || undefined,
    pickup_time: pickupTime || undefined,
    delivery_date: deliveryDate || undefined,
    delivery_time: deliveryTime || undefined,
    
    // Load specifications
    equipment: equipment,
    weight: weight,
    stops: stops,
    miles: miles,
    
    // Financial
    revenue: revenue,
    target_buy: targetBuy,
    max_buy: maxBuy,
    purch_tr: purchTr,
    net_mrg: netMrg,
    cm: cm,
    fuel_surcharge: fuelSurcharge,
    rate_cents: rateCents,
    
    // Contact information
    customer_name: customerName,
    customer_ref: getValue(headers.customer_ref),
    driver_name: getValue(headers.driver),
    dispatcher_name: getValue(headers.dispatcher),
    vendor_name: getValue(headers.vendor_dispatch),
    vendor_dispatch: getValue(headers.vendor_dispatch),
    
    // Additional EAX fields
    spot_bid: getValue(headers.spot_bid),
    docs_scanned: getValue(headers.docs_scanned),
    invoice_date: getValue(headers.invoice_date),
    invoice_audit: getValue(headers.invoice_audit),
    nbr_of_stops: stops,
    
    // Additional data
    notes: getValue(headers.spot_bid), // Use spot bid as notes for now
    archived: false,
    raw_data: {
      original_row: row,
      headers: headers,
      equipment_code: equipmentCode,
      is_usps_load: customerName && customerName.toLowerCase().includes('usps')
    }
  };
}

/**
 * Parse EAX CSV data into standardized load format
 */
export function parseEAXCSV(csvText: string): EAXLoadData[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error("CSV file appears to be empty or has no data rows");
  }
  
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const headerMap = detectEAXHeaders(headers);
  
  console.log("Detected EAX headers:", headerMap);
  console.log("Original headers:", headers);
  
  // Parse data rows
  const dataRows = lines.slice(1).map(line => parseCSVLine(line));
  
  return dataRows.map((row, index) => {
    try {
      return parseEAXLoadRow(row, headerMap);
    } catch (error) {
      console.error(`Error parsing row ${index + 1}:`, error);
      console.error("Row data:", row);
      throw error;
    }
  });
}

/**
 * Parse EAX Excel data into standardized load format
 */
export function parseEAXExcel(jsonData: any[][]): EAXLoadData[] {
  if (jsonData.length < 2) {
    throw new Error("Excel file appears to be empty or has no data rows");
  }
  
  // Parse headers
  const headers = jsonData[0] as string[];
  const headerMap = detectEAXHeaders(headers);
  
  console.log("Detected EAX headers:", headerMap);
  console.log("Original headers:", headers);
  
  // Parse data rows
  const dataRows = jsonData.slice(1) as any[][];
  
  return dataRows.map((row, index) => {
    try {
      return parseEAXLoadRow(row, headerMap);
    } catch (error) {
      console.error(`Error parsing row ${index + 1}:`, error);
      console.error("Row data:", row);
      throw error;
    }
  });
}

/**
 * Validate EAX load data
 */
export function validateEAXLoad(load: EAXLoadData): string[] {
  const errors: string[] = [];
  
  if (!load.rr_number || load.rr_number === 'UNKNOWN_') {
    errors.push("Missing RR number");
  }
  
  if (!load.origin_city || load.origin_city === 'Unknown') {
    errors.push("Missing origin city");
  }
  
  if (!load.destination_city || load.destination_city === 'Unknown') {
    errors.push("Missing destination city");
  }
  
  if (!load.equipment) {
    errors.push("Missing equipment type");
  }
  
  return errors;
}

/**
 * Get load summary statistics
 */
export function getLoadSummary(loads: EAXLoadData[]) {
  const totalLoads = loads.length;
  const validLoads = loads.filter(load => validateEAXLoad(load).length === 0).length;
  const invalidLoads = totalLoads - validLoads;
  
  const totalRevenue = loads.reduce((sum, load) => sum + (load.revenue || 0), 0);
  const totalMiles = loads.reduce((sum, load) => sum + (load.miles || 0), 0);
  const totalWeight = loads.reduce((sum, load) => sum + (load.weight || 0), 0);
  
  const equipmentTypes = [...new Set(loads.map(load => load.equipment))];
  const states = [...new Set([
    ...loads.map(load => load.origin_state),
    ...loads.map(load => load.destination_state)
  ])].filter(Boolean);
  
  return {
    totalLoads,
    validLoads,
    invalidLoads,
    totalRevenue,
    totalMiles,
    totalWeight,
    equipmentTypes,
    states,
    averageRevenue: totalLoads > 0 ? totalRevenue / totalLoads : 0,
    averageMiles: totalLoads > 0 ? totalMiles / totalLoads : 0,
    averageWeight: totalLoads > 0 ? totalWeight / totalLoads : 0
  };
}
