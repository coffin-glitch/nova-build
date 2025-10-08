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
  
  // Contact information
  customer_name?: string;
  customer_ref?: string;
  driver_name?: string;
  dispatcher_name?: string;
  vendor_name?: string;
  
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
  customer_name: number;
  customer_ref: number;
  equipment: number;
  weight: number;
  driver: number;
  miles: number;
  revenue: number;
  commodity: number;
  vendor_dispatch: number;
  origin: number;
  destination: number;
  stops: number;
  pickup_window: number;
  delivery_window: number;
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
    
    // Intelligent pattern matching for EAX headers
    if (normalizedHeader.match(/^(rr|rr#|rr number|rrnum)/)) {
      headerMap.rr_number = index;
    } else if (normalizedHeader.match(/^(load|load#|load number|loadnum)/)) {
      headerMap.load_number = index;
    } else if (normalizedHeader.match(/^(tm|tm#|tm number|tmnum)/)) {
      headerMap.tm_number = index;
    } else if (normalizedHeader.match(/^(sts|status|stat)/)) {
      headerMap.status = index;
    } else if (normalizedHeader.match(/^(pickup date|pickup|pu date|pu)$/) && !normalizedHeader.includes('time') && !normalizedHeader.includes('window')) {
      headerMap.pickup_date = index;
    } else if (normalizedHeader.match(/^(pickup time|pu time|pickup window|pu window)/)) {
      if (normalizedHeader.includes('window')) {
        headerMap.pickup_window = index;
      } else {
        headerMap.pickup_time = index;
      }
    } else if (normalizedHeader.match(/^(delivery date|delivery|del date|del)$/) && !normalizedHeader.includes('time') && !normalizedHeader.includes('window')) {
      headerMap.delivery_date = index;
    } else if (normalizedHeader.match(/^(delivery time|del time|delivery window|del window)/)) {
      if (normalizedHeader.includes('window')) {
        headerMap.delivery_window = index;
      } else {
        headerMap.delivery_time = index;
      }
    } else if (normalizedHeader.match(/^(dispatcher|disp)/)) {
      headerMap.dispatcher = index;
    } else if (normalizedHeader.match(/^(cust name|customer name|customer|cust)/)) {
      headerMap.customer_name = index;
    } else if (normalizedHeader.match(/^(cust ref|customer ref|custref)/)) {
      headerMap.customer_ref = index;
    } else if (normalizedHeader.match(/^(equipment|eq|equip)/)) {
      headerMap.equipment = index;
    } else if (normalizedHeader.match(/^(weight|wt)/)) {
      headerMap.weight = index;
    } else if (normalizedHeader.match(/^(driver|dr)/)) {
      headerMap.driver = index;
    } else if (normalizedHeader.match(/^(miles|tot miles|mi|distance)/)) {
      headerMap.miles = index;
    } else if (normalizedHeader.match(/^(revenue|rate|rev|rate per mile)$/)) {
      headerMap.revenue = index;
    } else if (normalizedHeader.match(/^(commodity|commod|spot bid|commodity type)/)) {
      headerMap.commodity = index;
    } else if (normalizedHeader.match(/^(vendor dispatch|vendor|vend)/)) {
      headerMap.vendor_dispatch = index;
    } else if (normalizedHeader.match(/^(origin|orig|from)/)) {
      headerMap.origin = index;
    } else if (normalizedHeader.match(/^(destination|dest|to)/)) {
      headerMap.destination = index;
    } else if (normalizedHeader.match(/^(stops|stop count|number of stops)/)) {
      headerMap.stops = index;
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
  
  // EAX equipment code mapping
  const equipmentMap: { [key: string]: string } = {
    'V': 'Dry Van',
    'R': 'Reefer',
    'VR': 'Van/Reefer',
    'F': 'Flatbed',
    'C': 'Container',
    'T': 'Tanker',
    'DRY VAN': 'Dry Van',
    'REEFER': 'Reefer',
    'FLATBED': 'Flatbed',
    'CONTAINER': 'Container',
    'TANKER': 'Tanker',
    'VAN/REEFER': 'Van/Reefer',
    'DRY': 'Dry Van',
    'REEF': 'Reefer',
    'FLAT': 'Flatbed',
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
  const pickupTime = getValue(headers.pickup_time);
  const deliveryTime = getValue(headers.delivery_time);
  const pickupWindow = getValue(headers.pickup_window);
  const deliveryWindow = getValue(headers.delivery_window);

  // Validate that pickup/delivery dates are actually dates, not times or currency
  const pickupDate = isValidDate(pickupDateRaw) ? pickupDateRaw : undefined;
  const deliveryDate = isValidDate(deliveryDateRaw) ? deliveryDateRaw : undefined;

  // Parse financial data
  const revenue = getNumber(headers.revenue);
  const miles = getInt(headers.miles);
  const weight = getNumber(headers.weight);
  const stops = getInt(headers.stops);

  // Parse equipment with intelligent mapping
  const equipmentCode = getValue(headers.equipment);
  const equipment = mapEquipmentType(equipmentCode);

  // Calculate derived values
  const rateCents = revenue ? Math.round(revenue * 100) : undefined;

  return {
    // Core identifiers
    rr_number: getValue(headers.rr_number) || `UNKNOWN_${Date.now()}`,
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
    pickup_window: pickupWindow || undefined,
    delivery_date: deliveryDate || undefined,
    delivery_time: deliveryTime || undefined,
    delivery_window: deliveryWindow || undefined,
    
    // Load specifications
    equipment: equipment,
    weight: weight,
    commodity: getValue(headers.commodity),
    stops: stops,
    miles: miles,
    
    // Financial
    revenue: revenue,
    rate_cents: rateCents,
    
    // Contact information
    customer_name: getValue(headers.customer_name),
    customer_ref: getValue(headers.customer_ref),
    driver_name: getValue(headers.driver),
    dispatcher_name: getValue(headers.dispatcher),
    vendor_name: getValue(headers.vendor_dispatch),
    
    // Additional data
    notes: getValue(headers.commodity), // Use commodity as notes for now
    archived: false,
    raw_data: {
      original_row: row,
      headers: headers,
      equipment_code: equipmentCode
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
