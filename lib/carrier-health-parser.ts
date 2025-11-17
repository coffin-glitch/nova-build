/**
 * Carrier Health Data Parser
 * Parses HTML/text from Highway.com Overview and Directory pages
 */

export interface ParsedOverviewData {
  carrierName?: string;
  mcNumber?: string;
  dotNumber?: string;
  scac?: string;
  dispatchContact?: {
    phone?: string;
    email?: string;
  };
  address?: string;
  dotStatus?: string;
  operatingStatus?: string;
  safetyRating?: string;
  certifications?: Array<string | { name: string; date?: string; verified?: boolean }>;
  eldStatus?: string;
  eldProvider?: string;
  connectionStatus?: 'Connected' | 'Not Connected' | 'Unknown';
  assessmentStatus?: 'Pass' | 'Partial Pass' | 'Fail' | 'Unknown';
  
  // Equipment
  powerUnits?: number;
  trailers?: number;
  averageFleetAge?: string;
  vehicleTypes?: Array<{ type: string; count: number }>;
  
  // Network
  network?: {
    preferredStates?: number;
    crossBorder?: boolean;
  };
  preferredAreas?: string;
  preferredStates?: number;
  crossBorder?: boolean;
  
  // Authority
  authority?: {
    types?: string[];
    history?: Array<{ type: string; action: string; date: string }>;
    oosRates?: {
      driver?: { oos: number; inspections: number; percentage: number; nationalAverage: number };
      vehicle?: { oos: number; inspections: number; percentage: number; nationalAverage: number };
    };
  };
  authorityTypes?: string[];
  authorityHistory?: Array<{ type: string; status: string; date?: string }>;
  
  // Insurance
  insurance?: {
    generalLiability?: {
      active: boolean;
      insurerName?: string;
      policyNumber?: string;
      effectiveDate?: string;
      expirationDate?: string;
      eachOccurrence?: string;
      generalAggregate?: string;
    };
    auto?: {
      active: boolean;
      insurerName?: string;
      policyNumber?: string;
      effectiveDate?: string;
      expirationDate?: string;
      limit?: string;
    };
    cargo?: {
      active: boolean;
      insurerName?: string;
      policyNumber?: string;
      effectiveDate?: string;
      expirationDate?: string;
      limit?: string;
    };
    trailerInterchange?: {
      active: boolean;
      insurerName?: string;
      policyNumber?: string;
      effectiveDate?: string;
      expirationDate?: string;
      limit?: string;
    };
  };
  
  // Safety - CSA BASICs
  safety?: {
    unsafeDriving?: { score?: string; percentile?: string; violations?: number };
    hoursOfService?: { score?: string; percentile?: string };
    vehicleMaintenance?: { score?: string; percentile?: string };
    controlledSubstances?: { score?: string; percentile?: string };
    driverFitness?: { score?: string; percentile?: string };
    totalViolations?: number;
  };
  
  // Inspections
  inspections?: {
    count?: number;
    ratio?: string;
    percentile?: string;
    history?: Array<{ date?: string; location?: string; type?: string; violations?: number; oos?: number }>;
  };
  
  // Crashes
  crashes?: {
    count24Months?: number;
    history?: Array<{ date?: string; location?: string; fatalities?: number; injuries?: number }>;
  };
  
  // Operations
  operations?: {
    fleetSize?: string;
    mcsipStep?: string;
    cargoCarried?: string[];
  };
  
  // Bluewire Score
  bluewireScore?: number;
  bluewireComponents?: {
    crashes?: number;
    violations?: number;
    csaBasics?: number;
    driverOos?: number;
    criticalAcuteViolations?: number;
    newEntrants?: number;
    mcs150?: number;
    judicialHellholes?: number;
    safetyRating?: number;
  };
  bluewireUpdated?: string;
  
  // ELD Connection Details
  eldConnection?: {
    status?: string;
    provider?: string;
    connectedDate?: string;
    lastUpdated?: string;
  };
}

export interface ParsedDirectoryData {
  verifiedUsers?: Array<{
    name?: string;
    phone?: string;
    email?: string;
    firstSeen?: string;
    lastSeen?: string;
    location?: string;
    country?: string;
    status?: 'Verified';
  }>;
  deactivatedUsers?: Array<{
    name?: string;
    phone?: string;
    email?: string;
    status?: 'Deactivated';
  }>;
  contacts?: Array<{
    role?: string; // 'Billing' | 'Dispatch' | 'Claims'
    name?: string;
    phone?: string;
    email?: string;
    created?: string;
  }>;
  rateConfirmationEmails?: Array<{
    email?: string;
    alias?: string;
    description?: string;
  }>;
  dispatchServices?: Array<{
    name?: string;
    users?: string[];
  }>;
  addresses?: Array<{
    type?: string; // 'Physical' | 'Mailing'
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    status?: string; // 'Current' | 'Inactive'
    firstSeen?: string;
  }>;
  fmcsaInfo?: {
    names?: string[];
    phones?: string[];
    emails?: string[];
    addresses?: string[];
    restricted?: boolean; // If "You are not authorized to view FMCSA contact information"
  };
}

/**
 * Parse Overview page HTML/text
 */
export function parseOverviewData(htmlOrText: string): ParsedOverviewData {
  const data: ParsedOverviewData = {};
  
  // Try to parse as HTML first (only in browser)
  let doc: Document | null = null;
  let text = htmlOrText;
  
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(htmlOrText, 'text/html');
      text = doc.body.innerText || doc.body.textContent || htmlOrText;
    } catch (e) {
      // If HTML parsing fails, treat as plain text
      text = htmlOrText;
    }
  } else {
    // Server-side: strip HTML tags for text extraction
    // BUT preserve the structured data marker which is plain text
    text = htmlOrText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    // Also check if structured data marker exists in original (it might be at the end)
    if (htmlOrText.includes('===STRUCTURED_SAFETY_DATA===')) {
      // Extract the structured data section from original before stripping HTML
      const markerIndex = htmlOrText.indexOf('===STRUCTURED_SAFETY_DATA===');
      if (markerIndex !== -1) {
        // Get everything after the marker
        const structuredSection = htmlOrText.substring(markerIndex);
        // Append it to text (it's already plain text, no HTML to strip)
        text = text + '\n\n' + structuredSection;
        console.log('✅ Preserved structured safety data marker in text extraction');
      }
    }
  }
  
  // Extract carrier name
  const nameMatch = text.match(/^([A-Z][A-Z\s&,.-]+(?:INC|LLC|CORP|LTD|CO|COMPANY)?)/m);
  if (nameMatch) {
    data.carrierName = nameMatch[1].trim();
  }
  
  // Extract MC number
  const mcMatch = text.match(/MC\s*(\d{7,8})/i);
  if (mcMatch) {
    data.mcNumber = mcMatch[1];
  }
  
  // Extract DOT number
  const dotMatch = text.match(/DOT\s*(\d{6,8})/i);
  if (dotMatch) {
    data.dotNumber = dotMatch[1];
  }
  
  // Extract SCAC
  const scacMatch = text.match(/SCAC\s+([A-Z]{2,4})/i);
  if (scacMatch) {
    data.scac = scacMatch[1];
  }
  
  // Extract Dispatch Contact - look specifically in the Dispatch Contact section
  const dispatchSection = text.match(/Dispatch\s*Contact[^\n]*\n[^\n]*?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/i);
  if (dispatchSection) {
    const phoneMatch = dispatchSection[0].match(/\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/);
    if (phoneMatch) {
      data.dispatchContact = { phone: `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}` };
    }
  } else {
    // Fallback: try to find phone near "Dispatch Contact" text
    const dispatchContactMatch = text.match(/Dispatch\s*Contact[^\n]*\n[^\n]*?([^\n]+)/i);
    if (dispatchContactMatch) {
      const phoneMatch = dispatchContactMatch[1].match(/\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/);
      if (phoneMatch) {
        data.dispatchContact = { phone: `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}` };
      }
    }
  }
  
  // Extract email - look in Dispatch Contact section first
  const emailSection = text.match(/Dispatch\s*Contact[^\n]*\n[^\n]*?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
  if (emailSection) {
    const emailMatch = emailSection[1];
    if (!data.dispatchContact) data.dispatchContact = {};
    data.dispatchContact.email = emailMatch;
  } else {
    // Fallback: find any email
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
      if (!data.dispatchContact) data.dispatchContact = {};
      data.dispatchContact.email = emailMatch[1];
    }
  }
  
  // Extract DOT Status
  if (text.match(/DOT\s*STATUS\s*ACTIVE/i)) {
    data.dotStatus = 'ACTIVE';
  } else if (text.match(/DOT\s*STATUS\s*INACTIVE/i)) {
    data.dotStatus = 'INACTIVE';
  }
  
  // Extract Operating Status - clean extraction, avoid long descriptions
  const operatingStatusPatterns = [
    /Operating\s*Status[:\s]*([A-Z][A-Za-z\s]{0,30}?)(?:\s+Safety|$|\n|\.)/i,
    /Operating\s*Status[:\s]*([A-Z][A-Za-z\s]{0,30}?)(?:\s+rating|$|\n|\.)/i,
  ];
  
  for (const pattern of operatingStatusPatterns) {
    const match = text.match(pattern);
    if (match) {
      let status = match[1].trim();
      // Clean up - remove common suffixes and limit length
      status = status.split(/\s+(?:Safety|rating|Certifications|CARB|ELD|The|carrier|credentials)/i)[0].trim();
      if (status && status.length < 50) {
        data.operatingStatus = status;
        break;
      }
    }
  }
  
  // Extract Safety Rating - clean extraction, avoid long descriptions
  const safetyRatingPatterns = [
    /Safety\s*rating[:\s]*([A-Z][A-Za-z\s]{0,30}?)(?:\s+Certifications|$|\n|\.)/i,
    /Safety\s*Rating[:\s]*([A-Z][A-Za-z\s]{0,30}?)(?:\s+CARB|$|\n|\.)/i,
    /Effective\s*Safety\s*Rating\s*Date[^\n]*?\n[^\n]*?([A-Z][A-Za-z\s]{0,30}?)(?:\s+Unsafe|$|\n|\.)/i,
  ];
  
  for (const pattern of safetyRatingPatterns) {
    const match = text.match(pattern);
    if (match) {
      let rating = match[1].trim();
      // Clean up - remove common suffixes and limit length
      rating = rating.split(/\s+(?:Certifications|CARB|ELD|The|carrier|credentials|Unsafe|Hours-of-Service)/i)[0].trim();
      // Only accept known safety rating values
      const validRatings = ['Satisfactory', 'Conditional', 'Unsatisfactory', 'Unrated'];
      if (rating && validRatings.some(v => rating.toLowerCase().includes(v.toLowerCase()))) {
        data.safetyRating = validRatings.find(v => rating.toLowerCase().includes(v.toLowerCase())) || rating;
        break;
      } else if (rating && rating.length < 30) {
        data.safetyRating = rating;
        break;
      }
    }
  }
  
  // Fallback: look for "Unrated" if no other match
  if (!data.safetyRating && text.match(/Safety\s*rating\s*Unrated/i)) {
    data.safetyRating = 'Unrated';
  }
  
  // Extract Connection Status - look for specific patterns, not long descriptions
  const connectionStatusMatch = text.match(/ELD\s+Connection\s+Status[^\n]*?\n[^\n]*?(Connected|Not\s+Connected)/i) ||
                                 text.match(/Connection\s+Status[^\n]*?(Connected|Not\s+Connected)/i);
  if (connectionStatusMatch) {
    const status = connectionStatusMatch[1].trim();
    if (status.toLowerCase().includes('connected') && !status.toLowerCase().includes('not')) {
      data.connectionStatus = 'Connected';
    } else {
      data.connectionStatus = 'Not Connected';
    }
  } else if (text.match(/Connected[^\n]{0,50}ELD/i) && !text.match(/Not\s+Connected/i)) {
    data.connectionStatus = 'Connected';
  } else {
    data.connectionStatus = 'Unknown';
  }
  
  // Extract Assessment Status - look for specific patterns
  const assessmentStatusMatch = text.match(/Assessment\s+Status[^\n]*?\n[^\n]*?(Pass|Partial\s+Pass|Fail)/i) ||
                                 text.match(/Assessment[^\n]{0,50}?(Pass|Partial\s+Pass|Fail)/i);
  if (assessmentStatusMatch) {
    const status = assessmentStatusMatch[1].trim();
    if (status.toLowerCase().includes('partial')) {
      data.assessmentStatus = 'Partial Pass';
    } else if (status.toLowerCase().includes('pass') && !status.toLowerCase().includes('partial')) {
      data.assessmentStatus = 'Pass';
    } else if (status.toLowerCase().includes('fail')) {
      data.assessmentStatus = 'Fail';
    } else {
      data.assessmentStatus = 'Unknown';
    }
  } else {
    data.assessmentStatus = 'Unknown';
  }
  
  // Extract ELD Provider - look for specific provider names, not long descriptions
  const eldProviderPatterns = [
    /ELD\s+Provider[:\s]+([A-Z][A-Za-z\s]+?)(?:\s+The|$|\n|\.)/i,
    /Connected[^\n]*?ELD[:\s]+([A-Z][A-Za-z\s]+?)(?:\s+The|$|\n|\.)/i,
    /(?:Greenlight|Samsara|Geotab|Omnitracs|PeopleNet|KeepTruckin|ELD|Verizon|Qualcomm|XRS|FleetComplete|Teletrac|Zonar|BigRoad|FleetMatics|GPS Insight|Linxup|FleetHub|Fleetio|FleetOne|FleetComplete|FleetLocate|FleetPulse|FleetView|FleetWise|FleetX|FleetY|FleetZ)[\s]*ELD/i,
  ];
  
  for (const pattern of eldProviderPatterns) {
    const match = text.match(pattern);
    if (match) {
      let provider = match[1]?.trim() || match[0]?.trim();
      // Clean up provider name - remove common suffixes and limit length
      provider = provider.replace(/\s+ELD\s*$/i, '').replace(/\s+The\s+carrier.*$/i, '').trim();
      if (provider && provider.length < 50 && !provider.toLowerCase().includes('credentials are valid')) {
        data.eldProvider = provider;
        break;
      }
    }
  }
  
  // Fallback: look for "Greenlight ELD" or similar patterns
  if (!data.eldProvider) {
    const simpleEldMatch = text.match(/(Greenlight|Samsara|Geotab|Omnitracs|PeopleNet|KeepTruckin)[\s]*ELD/i);
    if (simpleEldMatch) {
      data.eldProvider = simpleEldMatch[1] + ' ELD';
    }
  }
  
  // Extract Power Units
  const powerUnitsMatch = text.match(/(\d+)\s+Power\s+Units/i);
  if (powerUnitsMatch) {
    data.powerUnits = parseInt(powerUnitsMatch[1]);
  }
  
  // Extract Trailers
  const trailersMatch = text.match(/(\d+)\s+Trailers/i);
  if (trailersMatch) {
    data.trailers = parseInt(trailersMatch[1]);
  }
  
  // Extract Bluewire Score - look for "APPS" followed by number
  const bluewireMatch = text.match(/APPS[^\d]*(\d+\.?\d*)/i) || 
                        text.match(/Bluewire[^\d]*(\d+\.?\d*)/i) ||
                        text.match(/(\d+\.?\d*)\s*Bluewire/i);
  if (bluewireMatch) {
    data.bluewireScore = parseFloat(bluewireMatch[1]);
  }
  
  // Extract Bluewire components - More precise pattern matching
  // Look for the exact pattern in the Bluewire breakdown section
  const bluewireComponents: any = {};
  
  // Find the Bluewire section first to avoid matching wrong numbers
  const bluewireSection = text.match(/Bluewire[\s\S]*?(?=Privacy|©|$)/i);
  const searchText = bluewireSection ? bluewireSection[0] : text;
  
  // Pattern: "Crashes 61.3 / 100" or "Crashes: 61.3 / 100" - must have / 100
  const crashesMatch = searchText.match(/Crashes[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (crashesMatch) {
    const val = parseFloat(crashesMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.crashes = val;
    }
  }
  
  const violationsMatch = searchText.match(/Violations[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (violationsMatch) {
    const val = parseFloat(violationsMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.violations = val;
    }
  }
  
  const csaMatch = searchText.match(/CSA\s*BASICs[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (csaMatch) {
    const val = parseFloat(csaMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.csaBasics = val;
    }
  }
  
  const driverOosMatch = searchText.match(/Driver\s*OOS[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (driverOosMatch) {
    const val = parseFloat(driverOosMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.driverOos = val;
    }
  }
  
  const criticalMatch = searchText.match(/Critical\s*Acute\s*Violations[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (criticalMatch) {
    const val = parseFloat(criticalMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.criticalAcuteViolations = val;
    }
  }
  
  const newEntrantsMatch = searchText.match(/New\s*Entrants[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (newEntrantsMatch) {
    const val = parseFloat(newEntrantsMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.newEntrants = val;
    }
  }
  
  const mcs150Match = searchText.match(/MCS-150[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (mcs150Match) {
    const val = parseFloat(mcs150Match[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.mcs150 = val;
    }
  }
  
  const hellholesMatch = searchText.match(/Judicial\s*Hellholes[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (hellholesMatch) {
    const val = parseFloat(hellholesMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.judicialHellholes = val;
    }
  }
  
  const safetyRatingMatch = searchText.match(/Safety\s*Rating[:\s]+(\d+\.?\d*)\s*\/\s*100/i);
  if (safetyRatingMatch) {
    const val = parseFloat(safetyRatingMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      bluewireComponents.safetyRating = val;
    }
  }
  
  if (Object.keys(bluewireComponents).length > 0) {
    data.bluewireComponents = bluewireComponents;
  }
  
  // Extract Bluewire updated timestamp - clean extraction
  const updatedMatch = searchText.match(/Updated\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                       searchText.match(/Updated\s+at\s+([^\n]+?)(?:\s+Privacy|\s+©|$)/i);
  if (updatedMatch) {
    // Clean up the timestamp - remove HTML entities and extra text
    let timestamp = updatedMatch[1].trim();
    timestamp = timestamp.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
    // Remove any trailing HTML/CSS noise
    timestamp = timestamp.split(/\s+(?:Privacy|©|@keyframes|\.intercom)/i)[0].trim();
    if (timestamp && timestamp.length < 50) { // Reasonable timestamp length
      data.bluewireUpdated = timestamp;
    }
  }
  
  // Extract Crash Count (24 months) - look for "15 Reported Crashes" or similar
  const crash24Match = text.match(/(\d+)\s+Reported\s+Crashes/i) ||
                       text.match(/Crashes[^\d]*(\d+)[^\d]*24/i) ||
                       text.match(/Crash\s*History[^\d]*(\d+)/i);
  if (crash24Match) {
    if (!data.crashes) data.crashes = {};
    data.crashes.count24Months = parseInt(crash24Match[1]);
  }
  
  // Extract Inspection Count
  const inspectionMatch = text.match(/(\d+)\s+Inspections/i) ||
                          text.match(/Inspection\s*History[^\d]*(\d+)/i);
  if (inspectionMatch) {
    if (!data.inspections) data.inspections = {};
    data.inspections.count = parseInt(inspectionMatch[1]);
  }
  
  // Extract Inspection Ratio
  const ratioMatch = text.match(/Inspection-to-Fleet\s*Ratio[^\d]*(\d+)\/(\d+)/i) ||
                    text.match(/(\d+)\/(\d+)\s*Inspection/i);
  if (ratioMatch) {
    if (!data.inspections) data.inspections = {};
    data.inspections.ratio = `${ratioMatch[1]}/${ratioMatch[2]}`;
  }
  
  // Extract Inspection History - detailed records
  if (!data.inspections) data.inspections = {};
  const inspectionHistory: any[] = [];
  // Pattern: Date ReportNumber State PlateNumber PlateState Type Violations OOS
  const inspectionHistoryPattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d+[A-Z]?\d+)\s+([A-Z]{2})\s+([A-Z0-9]+)\s+([A-Z]{2})\s+([A-Za-z\s]+)\s+(\d+)\s+(\d+)/g;
  let inspectionRecord;
  while ((inspectionRecord = inspectionHistoryPattern.exec(text)) !== null) {
    inspectionHistory.push({
      date: inspectionRecord[1],
      reportNumber: inspectionRecord[2],
      state: inspectionRecord[3],
      plateNumber: inspectionRecord[4],
      plateState: inspectionRecord[5],
      type: inspectionRecord[6].trim(),
      violations: parseInt(inspectionRecord[7]),
      oos: parseInt(inspectionRecord[8]),
    });
  }
  if (inspectionHistory.length > 0) {
    data.inspections.history = inspectionHistory;
  }
  
  // Extract Inspection Percentile
  const inspectionPercentileMatch = text.match(/Top\s+(\d+)%\s+Percentile\s+Ranking/i) ||
                                    text.match(/(\d+)%\s+Percentile\s+Ranking/i);
  if (inspectionPercentileMatch) {
    if (!data.inspections) data.inspections = {};
    data.inspections.percentile = inspectionPercentileMatch[1] + '%';
  }
  
  // Extract Crash History - detailed records
  if (!data.crashes) data.crashes = {};
  const crashHistory: any[] = [];
  // Pattern: Date ReportNumber VIN LocationState PlateState PlateNumber Fatalities Injuries
  const crashHistoryPattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z]{2})\s+([A-Z]{2})\s+([A-Z0-9]+)\s+(\d+)\s*(\d*)/g;
  let crashRecord;
  while ((crashRecord = crashHistoryPattern.exec(text)) !== null) {
    crashHistory.push({
      date: crashRecord[1],
      reportNumber: crashRecord[2],
      vin: crashRecord[3],
      locationState: crashRecord[4],
      plateState: crashRecord[5],
      plateNumber: crashRecord[6],
      fatalities: parseInt(crashRecord[7]) || 0,
      injuries: parseInt(crashRecord[8]) || 0,
    });
  }
  if (crashHistory.length > 0) {
    data.crashes.history = crashHistory;
  }
  
  // Extract Network information
  if (!data.network) data.network = {};
  const preferredStatesMatch = text.match(/(\d+)\s+States/i);
  if (preferredStatesMatch) {
    data.network.preferredStates = parseInt(preferredStatesMatch[1]);
  }
  
  const crossBorderMatch = text.match(/Cross\s+Border\s+(Yes|No)/i);
  if (crossBorderMatch) {
    data.network.crossBorder = crossBorderMatch[1].toLowerCase() === 'yes';
  }
  
  // Extract Authority information
  if (!data.authority) data.authority = {};
  const authorityTypes: string[] = [];
  if (text.match(/Common/i)) authorityTypes.push('Common');
  if (text.match(/Contract/i)) authorityTypes.push('Contract');
  if (text.match(/Broker/i)) authorityTypes.push('Broker');
  if (authorityTypes.length > 0) {
    data.authority.types = authorityTypes;
  }
  
  // Extract Authority History - more precise pattern
  const authorityHistory: any[] = [];
  // Pattern: TYPE ACTION DATE - limit type to reasonable length
  const authorityHistoryPattern = /([A-Z][A-Z\s]{0,40}?)\s+(WITHDRAWN|GRANTED|REVOKED)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s|$|\.)/gi;
  let authRecord;
  while ((authRecord = authorityHistoryPattern.exec(text)) !== null) {
    const authType = authRecord[1].trim();
    const authAction = authRecord[2].trim();
    const authDate = authRecord[3].trim();
    
    // Validate: type should be reasonable length, action should be valid, date should match pattern
    if (authType.length > 0 && authType.length < 50 && 
        ['WITHDRAWN', 'GRANTED', 'REVOKED'].includes(authAction) &&
        authDate.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
      authorityHistory.push({
        type: authType,
        action: authAction,
        date: authDate,
      });
    }
  }
  if (authorityHistory.length > 0) {
    data.authority.history = authorityHistory;
  }
  
  // Extract Out of Service Rates
  if (!data.authority) data.authority = {};
  const oosRates: any = {};
  const driverOosRateMatch = text.match(/Driver\s+(\d+)\s+(\d+)\s+([\d.]+)%\s+([\d.]+)%/i);
  if (driverOosRateMatch) {
    oosRates.driver = {
      oos: parseInt(driverOosRateMatch[1]),
      inspections: parseInt(driverOosRateMatch[2]),
      percentage: parseFloat(driverOosRateMatch[3]),
      nationalAverage: parseFloat(driverOosRateMatch[4]),
    };
  }
  const vehicleOosMatch = text.match(/Vehicle\s+(\d+)\s+(\d+)\s+([\d.]+)%\s+([\d.]+)%/i);
  if (vehicleOosMatch) {
    oosRates.vehicle = {
      oos: parseInt(vehicleOosMatch[1]),
      inspections: parseInt(vehicleOosMatch[2]),
      percentage: parseFloat(vehicleOosMatch[3]),
      nationalAverage: parseFloat(vehicleOosMatch[4]),
    };
  }
  if (Object.keys(oosRates).length > 0) {
    data.authority.oosRates = oosRates;
  }
  
  // Extract Operations information
  if (!data.operations) data.operations = {};
  const fleetSizeMatch = text.match(/Fleet\s+Size\s+(\d+-\d+)/i);
  if (fleetSizeMatch) {
    data.operations.fleetSize = fleetSizeMatch[1];
  }
  
  const cargoCarried: string[] = [];
  if (text.match(/General\s+Freight/i)) cargoCarried.push('General Freight');
  if (text.match(/Intermodal\s+Containers/i)) cargoCarried.push('Intermodal Containers');
  if (cargoCarried.length > 0) {
    data.operations.cargoCarried = cargoCarried;
  }
  
  // Extract Certifications with dates
  const certifications: Array<{ name: string; date?: string; verified?: boolean }> = [];
  const carbMatch = text.match(/CARB\s+Truck\s+and\s+Bus\s+Certified(?:\s+(\d{1,2}\/\d{1,2}\/\d{2,4}))?/i);
  if (carbMatch) {
    certifications.push({ name: 'CARB Truck and Bus', date: carbMatch[1] });
  }
  
  const tankMatch = text.match(/Tank\s+Endorsed\s+Drivers\s+Certified(?:\s+(?:Highway\s+Verified|Self\s+Reported)\s+(\d{1,2}\/\d{1,2}\/\d{2,4}))?/i);
  if (tankMatch) {
    certifications.push({ name: 'Tank Endorsed Drivers', date: tankMatch[1] });
  }
  
  if (certifications.length > 0) {
    data.certifications = certifications;
  }
  
  // Extract Average Fleet Age
  const fleetAgeMatch = text.match(/Average\s*Fleet\s*Age[^\d]*(\d+)\s*yrs?\s*old/i);
  if (fleetAgeMatch) {
    data.averageFleetAge = `${fleetAgeMatch[1]} yrs old`;
  }
  
  // Extract ELD Connection details - clean extraction with strict patterns
  const eldConnectedMatch = text.match(/Connected\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s|$|\.)/i);
  if (eldConnectedMatch) {
    if (!data.eldConnection) data.eldConnection = {};
    // Extract only the date part, remove any trailing text
    const dateStr = eldConnectedMatch[1].trim();
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
      data.eldConnection.connectedDate = dateStr;
    }
  }
  
  const eldUpdatedMatch = text.match(/Updated\s+(\d+)\s+minutes?\s+ago(?:\s|$|\.)/i);
  if (eldUpdatedMatch) {
    if (!data.eldConnection) data.eldConnection = {};
    const minutes = eldUpdatedMatch[1].trim();
    if (minutes.match(/^\d+$/)) {
      data.eldConnection.lastUpdated = `${minutes} minutes ago`;
    }
  }
  
  // Extract ELD Provider from connection section
  if (!data.eldProvider && data.eldConnection) {
    const eldProviderMatch = text.match(/ELD\s+Connection\s+Status[^\n]*?\n[^\n]*?([A-Z][A-Za-z\s]+?)(?:\s+ELD|$|\n)/i);
    if (eldProviderMatch && eldProviderMatch[1].trim().length < 30) {
      data.eldProvider = eldProviderMatch[1].trim();
    }
  }
  
  // Extract Safety BASICs scores - both CSA Percentile and BASIC Score
  if (!data.safety) data.safety = {};
  
  // First, check if structured safety data was provided (from the scraper)
  // Try multiple regex patterns to find the structured data
  console.log('🔍 Searching for structured safety data marker in text (length:', text.length, ')');
  console.log('🔍 Text ends with:', text.substring(Math.max(0, text.length - 500)));
  
  let structuredDataMatch = text.match(/===STRUCTURED_SAFETY_DATA===\s*([\s\S]*?)(?=\n\n|$)/);
  if (!structuredDataMatch) {
    // Try without the trailing newline requirement
    structuredDataMatch = text.match(/===STRUCTURED_SAFETY_DATA===\s*([\s\S]*)/);
  }
  if (!structuredDataMatch) {
    // Try with more flexible whitespace
    structuredDataMatch = text.match(/===STRUCTURED_SAFETY_DATA===([\s\S]*?)(?=\n\n===|$)/);
  }
  if (!structuredDataMatch) {
    // Try finding it anywhere in the text (most permissive)
    const markerIndex = text.indexOf('===STRUCTURED_SAFETY_DATA===');
    if (markerIndex !== -1) {
      const afterMarker = text.substring(markerIndex + '===STRUCTURED_SAFETY_DATA==='.length);
      // Try to extract JSON (look for opening brace to closing brace)
      const jsonMatch = afterMarker.match(/\s*(\{[\s\S]*\})/);
      if (jsonMatch) {
        structuredDataMatch = ['===STRUCTURED_SAFETY_DATA===' + jsonMatch[0], jsonMatch[1]];
        console.log('✅ Found structured data using indexOf method');
      }
    }
  }
  
  if (structuredDataMatch) {
    try {
      const jsonString = structuredDataMatch[1].trim();
      console.log('Found structured safety data, JSON string length:', jsonString.length);
      console.log('JSON string preview:', jsonString.substring(0, 200));
      
      const structuredSafety = JSON.parse(jsonString);
      console.log('Parsing structured safety data:', JSON.stringify(structuredSafety, null, 2));
      
      // Process each category with explicit null handling
      // Always set the safety data, even if values are null (so we don't fall back to regex)
      // Use null instead of undefined so the field is preserved in JSON serialization
      if (structuredSafety.unsafeDriving != null) {
        data.safety.unsafeDriving = {
          percentile: structuredSafety.unsafeDriving.percentile != null && structuredSafety.unsafeDriving.percentile !== '' 
            ? String(structuredSafety.unsafeDriving.percentile) + '%' 
            : null,
          score: structuredSafety.unsafeDriving.score != null && structuredSafety.unsafeDriving.score !== '' 
            ? String(structuredSafety.unsafeDriving.score) 
            : null,
        };
        console.log('Set unsafeDriving:', data.safety.unsafeDriving);
      }
      if (structuredSafety.hoursOfService != null) {
        data.safety.hoursOfService = {
          percentile: structuredSafety.hoursOfService.percentile != null && structuredSafety.hoursOfService.percentile !== '' 
            ? String(structuredSafety.hoursOfService.percentile) + '%' 
            : null,
          score: structuredSafety.hoursOfService.score != null && structuredSafety.hoursOfService.score !== '' 
            ? String(structuredSafety.hoursOfService.score) 
            : null,
        };
        console.log('Set hoursOfService:', data.safety.hoursOfService);
      }
      if (structuredSafety.vehicleMaintenance != null) {
        data.safety.vehicleMaintenance = {
          percentile: structuredSafety.vehicleMaintenance.percentile != null && structuredSafety.vehicleMaintenance.percentile !== '' 
            ? String(structuredSafety.vehicleMaintenance.percentile) + '%' 
            : null,
          score: structuredSafety.vehicleMaintenance.score != null && structuredSafety.vehicleMaintenance.score !== '' 
            ? String(structuredSafety.vehicleMaintenance.score) 
            : null,
        };
        console.log('Set vehicleMaintenance:', data.safety.vehicleMaintenance);
      }
      if (structuredSafety.controlledSubstances != null) {
        data.safety.controlledSubstances = {
          percentile: structuredSafety.controlledSubstances.percentile != null && structuredSafety.controlledSubstances.percentile !== '' 
            ? String(structuredSafety.controlledSubstances.percentile) + '%' 
            : null,
          score: structuredSafety.controlledSubstances.score != null && structuredSafety.controlledSubstances.score !== '' 
            ? String(structuredSafety.controlledSubstances.score) 
            : null,
        };
        console.log('Set controlledSubstances:', data.safety.controlledSubstances);
      }
      if (structuredSafety.driverFitness != null) {
        data.safety.driverFitness = {
          percentile: structuredSafety.driverFitness.percentile != null && structuredSafety.driverFitness.percentile !== '' 
            ? String(structuredSafety.driverFitness.percentile) + '%' 
            : null,
          score: structuredSafety.driverFitness.score != null && structuredSafety.driverFitness.score !== '' 
            ? String(structuredSafety.driverFitness.score) 
            : null,
        };
        console.log('Set driverFitness:', data.safety.driverFitness);
      }
      console.log('Final parsed structured safety data result:', JSON.stringify(data.safety, null, 2));
    } catch (e: any) {
      console.error('Failed to parse structured safety data:', e);
      console.error('Error details:', {
        message: e.message,
        stack: e.stack,
        jsonString: structuredDataMatch[1]?.substring(0, 500),
      });
    }
  } else {
    console.log('⚠️ No structured safety data marker found in text');
  }
  
  // Track if we successfully parsed structured data
  const hasStructuredData = structuredDataMatch != null && data.safety && (
    data.safety.unsafeDriving || 
    data.safety.hoursOfService || 
    data.safety.vehicleMaintenance || 
    data.safety.controlledSubstances || 
    data.safety.driverFitness
  );
  
  // Fallback: Extract from text using regex patterns (only if structured data wasn't found)
  // Unsafe Driving - extract both CSA Percentile and BASIC Score
  if (!hasStructuredData && !data.safety.unsafeDriving) {
  const unsafeDrivingSection = text.match(/Unsafe\s*Driving[\s\S]*?(?=Hours-of-Service|Vehicle\s*Maintenance|Controlled\s*Substances|Driver\s*Fitness|$)/i);
  if (unsafeDrivingSection) {
    const unsafeText = unsafeDrivingSection[0];
    const percentileMatch = unsafeText.match(/CSA\s*Percentile\s*Equivalent[:\s]*(\d+\.?\d*)%/i);
    const basicScoreMatch = unsafeText.match(/BASIC\s*Score[:\s]*(\d+\.?\d*)/i);
    data.safety.unsafeDriving = {
      percentile: percentileMatch ? percentileMatch[1] + '%' : undefined,
      score: basicScoreMatch ? basicScoreMatch[1] : undefined,
    };
    }
  }
  
  // Hours of Service - extract both CSA Percentile and BASIC Score
  if (!hasStructuredData && !data.safety.hoursOfService) {
  const hosSection = text.match(/Hours-of-Service\s*Compliance[\s\S]*?(?=Vehicle\s*Maintenance|Controlled\s*Substances|Driver\s*Fitness|Unsafe\s*Driving|$)/i) ||
                     text.match(/HOS[\s\S]*?(?=Vehicle\s*Maintenance|Controlled\s*Substances|Driver\s*Fitness|Unsafe\s*Driving|$)/i);
  if (hosSection) {
    const hosText = hosSection[0];
    const percentileMatch = hosText.match(/CSA\s*Percentile\s*Equivalent[:\s]*(\d+\.?\d*)%/i);
    const basicScoreMatch = hosText.match(/BASIC\s*Score[:\s]*(\d+\.?\d*)/i);
    data.safety.hoursOfService = {
      percentile: percentileMatch ? percentileMatch[1] + '%' : undefined,
      score: basicScoreMatch ? basicScoreMatch[1] : undefined,
    };
    }
  }
  
  // Vehicle Maintenance - extract both CSA Percentile and BASIC Score
  if (!hasStructuredData && !data.safety.vehicleMaintenance) {
  const vehicleSection = text.match(/Vehicle\s*Maintenance[\s\S]*?(?=Controlled\s*Substances|Driver\s*Fitness|Hours-of-Service|Unsafe\s*Driving|$)/i);
  if (vehicleSection) {
    const vehicleText = vehicleSection[0];
    const percentileMatch = vehicleText.match(/CSA\s*Percentile\s*Equivalent[:\s]*(\d+\.?\d*)%/i);
    const basicScoreMatch = vehicleText.match(/BASIC\s*Score[:\s]*(\d+\.?\d*)/i);
    data.safety.vehicleMaintenance = {
      percentile: percentileMatch ? percentileMatch[1] + '%' : undefined,
      score: basicScoreMatch ? basicScoreMatch[1] : undefined,
    };
    }
  }
  
  // Controlled Substances - extract both CSA Percentile and BASIC Score
  if (!hasStructuredData && !data.safety.controlledSubstances) {
  const drugSection = text.match(/Controlled\s*Substances[^\d]*[\s\S]*?(?=Driver\s*Fitness|Vehicle\s*Maintenance|Hours-of-Service|Unsafe\s*Driving|$)/i) ||
                      text.match(/Drug[^\d]*[\s\S]*?(?=Driver\s*Fitness|Vehicle\s*Maintenance|Hours-of-Service|Unsafe\s*Driving|$)/i);
  if (drugSection) {
    const drugText = drugSection[0];
    const percentileMatch = drugText.match(/CSA\s*Percentile\s*Equivalent[:\s]*(\d+\.?\d*)%/i);
    const basicScoreMatch = drugText.match(/BASIC\s*Score[:\s]*(\d+\.?\d*)/i);
    data.safety.controlledSubstances = {
      percentile: percentileMatch ? percentileMatch[1] + '%' : undefined,
      score: basicScoreMatch ? basicScoreMatch[1] : undefined,
    };
    }
  }
  
  // Driver Fitness - extract both CSA Percentile and BASIC Score
  if (!hasStructuredData && !data.safety.driverFitness) {
  const driverSection = text.match(/Driver\s*Fitness[\s\S]*?(?=Controlled\s*Substances|Vehicle\s*Maintenance|Hours-of-Service|Unsafe\s*Driving|$)/i);
  if (driverSection) {
    const driverText = driverSection[0];
    const percentileMatch = driverText.match(/CSA\s*Percentile\s*Equivalent[:\s]*(\d+\.?\d*)%/i);
    const basicScoreMatch = driverText.match(/BASIC\s*Score[:\s]*(\d+\.?\d*)/i);
    data.safety.driverFitness = {
      percentile: percentileMatch ? percentileMatch[1] + '%' : undefined,
      score: basicScoreMatch ? basicScoreMatch[1] : undefined,
    };
    }
  }
  
  // Total Violations
  const totalViolationsMatch = text.match(/Total\s*Violations[^\d]*(\d+)/i);
  if (totalViolationsMatch) {
    data.safety.totalViolations = parseInt(totalViolationsMatch[1]);
  }
  
  // Extract Insurance Information
  if (!data.insurance) data.insurance = {};
  
  // Helper function to extract insurance details with multiple pattern matching
  const extractInsuranceDetails = (sectionText: string) => {
    const isActive = /Active/i.test(sectionText);
    
    // Try multiple patterns for each field
    // Pattern 1: "Insurer Name\nValue" or "Insurer Name: Value"
    // Pattern 2: "Insurer Name\n\nValue" (with blank line)
    // Pattern 3: "Insurer Name Value" (on same line)
    const insurerPatterns = [
      /Insurer\s+Name[:\s]*\n\s*([^\n]+?)(?:\n|Policy|$)/i,
      /Insurer\s+Name[:\s]*\n\s*\n\s*([^\n]+?)(?:\n|Policy|$)/i,
      /Insurer\s+Name[:\s]+([^\n]+?)(?:\n|Policy|$)/i,
    ];
    
    const policyPatterns = [
      /Policy\s+Number[:\s]*\n\s*([A-Z0-9-]+)/i,
      /Policy\s+Number[:\s]*\n\s*\n\s*([A-Z0-9-]+)/i,
      /Policy\s+Number[:\s]+([A-Z0-9-]+)/i,
    ];
    
    const effectivePatterns = [
      /Effective\s+Date[:\s]*\n\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /Effective\s+Date[:\s]*\n\s*\n\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /Effective\s+Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ];
    
    const expirationPatterns = [
      /Expiration\s+Date[:\s]*\n\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /Expiration\s+Date[:\s]*\n\s*\n\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /Expiration\s+Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ];
    
    let insurerName: string | undefined;
    for (const pattern of insurerPatterns) {
      const match = sectionText.match(pattern);
      if (match && match[1]) {
        insurerName = match[1].trim();
        break;
      }
    }
    
    let policyNumber: string | undefined;
    for (const pattern of policyPatterns) {
      const match = sectionText.match(pattern);
      if (match && match[1]) {
        policyNumber = match[1].trim();
        break;
      }
    }
    
    let effectiveDate: string | undefined;
    for (const pattern of effectivePatterns) {
      const match = sectionText.match(pattern);
      if (match && match[1]) {
        effectiveDate = match[1].trim();
        break;
      }
    }
    
    let expirationDate: string | undefined;
    for (const pattern of expirationPatterns) {
      const match = sectionText.match(pattern);
      if (match && match[1]) {
        expirationDate = match[1].trim();
        break;
      }
    }
    
    return { isActive, insurerName, policyNumber, effectiveDate, expirationDate };
  };
  
  // General Liability Insurance
  const glSection = text.match(/General\s+Liability[\s\S]*?(?=Auto|Cargo|Trailer|$)/i);
  if (glSection) {
    const glText = glSection[0];
    const details = extractInsuranceDetails(glText);
    
    // Extract General Liability specific fields
    const eachOccurrencePatterns = [
      /Each\s+Ocurrence[:\s]*\n\s*\$?([\d,]+)/i,
      /Each\s+Ocurrence[:\s]*\n\s*\n\s*\$?([\d,]+)/i,
      /Each\s+Ocurrence[:\s]+\$?([\d,]+)/i,
      /Each\s+Occurrence[:\s]*\n\s*\$?([\d,]+)/i, // Also check for correct spelling
    ];
    
    const aggregatePatterns = [
      /General\s+Aggregate[:\s]*\n\s*\$?([\d,]+)/i,
      /General\s+Aggregate[:\s]*\n\s*\n\s*\$?([\d,]+)/i,
      /General\s+Aggregate[:\s]+\$?([\d,]+)/i,
    ];
    
    let eachOccurrence: string | undefined;
    for (const pattern of eachOccurrencePatterns) {
      const match = glText.match(pattern);
      if (match && match[1]) {
        eachOccurrence = `$${match[1].replace(/,/g, '')}`;
        break;
      }
    }
    
    let generalAggregate: string | undefined;
    for (const pattern of aggregatePatterns) {
      const match = glText.match(pattern);
      if (match && match[1]) {
        generalAggregate = `$${match[1].replace(/,/g, '')}`;
        break;
      }
    }
    
    if (details.isActive || details.insurerName || details.policyNumber) {
      data.insurance.generalLiability = {
        active: details.isActive,
        insurerName: details.insurerName,
        policyNumber: details.policyNumber,
        effectiveDate: details.effectiveDate,
        expirationDate: details.expirationDate,
        eachOccurrence,
        generalAggregate,
      };
    }
  }
  
  // Auto Insurance
  const autoSection = text.match(/Auto[\s\S]*?(?=Cargo|Trailer|General|$)/i);
  if (autoSection) {
    const autoText = autoSection[0];
    const details = extractInsuranceDetails(autoText);
    
    const limitPatterns = [
      /Limit[:\s]*\n\s*\$?([\d,]+)/i,
      /Limit[:\s]*\n\s*\n\s*\$?([\d,]+)/i,
      /Limit[:\s]+\$?([\d,]+)/i,
    ];
    
    let limit: string | undefined;
    for (const pattern of limitPatterns) {
      const match = autoText.match(pattern);
      if (match && match[1]) {
        limit = `$${match[1].replace(/,/g, '')}`;
        break;
      }
    }
    
    if (details.isActive || details.insurerName || details.policyNumber) {
      data.insurance.auto = {
        active: details.isActive,
        insurerName: details.insurerName,
        policyNumber: details.policyNumber,
        effectiveDate: details.effectiveDate,
        expirationDate: details.expirationDate,
        limit,
      };
    }
  }
  
  // Cargo Insurance
  const cargoSection = text.match(/Cargo[\s\S]*?(?=Trailer|General|Auto|$)/i);
  if (cargoSection) {
    const cargoText = cargoSection[0];
    const details = extractInsuranceDetails(cargoText);
    
    const limitPatterns = [
      /Limit[:\s]*\n\s*\$?([\d,]+)/i,
      /Limit[:\s]*\n\s*\n\s*\$?([\d,]+)/i,
      /Limit[:\s]+\$?([\d,]+)/i,
    ];
    
    let limit: string | undefined;
    for (const pattern of limitPatterns) {
      const match = cargoText.match(pattern);
      if (match && match[1]) {
        limit = `$${match[1].replace(/,/g, '')}`;
        break;
      }
    }
    
    if (details.isActive || details.insurerName || details.policyNumber) {
      data.insurance.cargo = {
        active: details.isActive,
        insurerName: details.insurerName,
        policyNumber: details.policyNumber,
        effectiveDate: details.effectiveDate,
        expirationDate: details.expirationDate,
        limit,
      };
    }
  }
  
  // Trailer Interchange Insurance
  const trailerSection = text.match(/Trailer\s+Interchange[\s\S]*?(?=General|Auto|Cargo|$)/i);
  if (trailerSection) {
    const trailerText = trailerSection[0];
    const details = extractInsuranceDetails(trailerText);
    
    const limitPatterns = [
      /Limit[:\s]*\n\s*\$?([\d,]+)/i,
      /Limit[:\s]*\n\s*\n\s*\$?([\d,]+)/i,
      /Limit[:\s]+\$?([\d,]+)/i,
    ];
    
    let limit: string | undefined;
    for (const pattern of limitPatterns) {
      const match = trailerText.match(pattern);
      if (match && match[1]) {
        limit = `$${match[1].replace(/,/g, '')}`;
        break;
      }
    }
    
    if (details.isActive || details.insurerName || details.policyNumber) {
      data.insurance.trailerInterchange = {
        active: details.isActive,
        insurerName: details.insurerName,
        policyNumber: details.policyNumber,
        effectiveDate: details.effectiveDate,
        expirationDate: details.expirationDate,
        limit,
      };
    }
  }
  
  return data;
}

/**
 * Parse Directory page HTML/text
 */
export function parseDirectoryData(htmlOrText: string): ParsedDirectoryData {
  const data: ParsedDirectoryData = {};
  
  // Check if the input is JSON (structured data from the scraper)
  try {
    const jsonData = JSON.parse(htmlOrText);
    if (jsonData.verifiedUsers || jsonData.contacts || jsonData.rateConfirmationEmails || jsonData.addresses) {
      // This is structured data from the scraper
      console.log('Parsing structured directory data:', {
        verifiedUsers: jsonData.verifiedUsers?.length || 0,
        contacts: jsonData.contacts?.length || 0,
        rateConfirmationEmails: jsonData.rateConfirmationEmails?.length || 0,
        addresses: jsonData.addresses?.length || 0,
      });
      
      // Convert structured data to our format
      if (jsonData.verifiedUsers && jsonData.verifiedUsers.length > 0) {
        data.verifiedUsers = jsonData.verifiedUsers.map((u: any) => ({
          name: u.name,
          phone: u.phone,
          email: u.email,
          firstSeen: u.firstSeen ? `${u.firstSeen} ${u.firstSeenLocation || ''}`.trim() : undefined,
          lastSeen: u.lastSeen ? `${u.lastSeen} ${u.lastSeenLocation || ''}`.trim() : undefined,
          location: u.firstSeenLocation && u.lastSeenLocation ? `${u.firstSeenLocation} / ${u.lastSeenLocation}` : (u.firstSeenLocation || u.lastSeenLocation),
          country: u.country,
          status: 'Verified' as const,
        })).filter((u: any) => u.name || u.phone || u.email);
      }
      
      if (jsonData.contacts && jsonData.contacts.length > 0) {
        data.contacts = jsonData.contacts.map((c: any) => ({
          role: c.role || undefined,
          name: c.name && c.name !== '-' ? c.name : undefined,
          phone: c.phone || undefined,
          email: c.email && c.email !== c.name ? c.email : undefined, // Don't use name as email
          created: c.created || undefined,
        })).filter((c: any) => {
          // Include if we have at least name and (phone or email), or role and contact info
          return (c.name && (c.phone || c.email)) || (c.role && (c.name || c.phone || c.email));
        });
      }
      
      if (jsonData.rateConfirmationEmails && jsonData.rateConfirmationEmails.length > 0) {
        data.rateConfirmationEmails = jsonData.rateConfirmationEmails.map((e: any) => ({
          email: e.email,
          alias: e.alias && e.alias !== '-' ? e.alias : undefined,
          description: e.description && e.description !== '-' ? e.description : undefined,
        })).filter((e: any) => e.email);
      }
      
      if (jsonData.addresses && jsonData.addresses.length > 0) {
        data.addresses = jsonData.addresses.map((a: any) => {
          const addressParts = a.address?.split(',').map((p: string) => p.trim()) || [];
          return {
            type: a.type || undefined,
            status: a.status || undefined,
            address: addressParts[0] || undefined,
            city: addressParts[1] || undefined,
            state: addressParts[2]?.split(' ')[0] || undefined,
            zip: addressParts[2]?.split(' ')[1] || undefined,
            firstSeen: a.firstSeen || undefined,
          };
        }).filter((a: any) => a.address);
      }
      
      return data;
    }
  } catch (e) {
    // Not JSON, continue with HTML/text parsing
  }
  
  // Clean up the input - remove script tags and Tampermonkey wrapper code
  let cleanedHtml = htmlOrText;
  cleanedHtml = cleanedHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleanedHtml = cleanedHtml.replace(/window\["__f__[\s\S]*?<\/script>/gi, '');
  cleanedHtml = cleanedHtml.replace(/window\["__f__[\s\S]*?}/g, '');
  cleanedHtml = cleanedHtml.replace(/\(async\s+function[\s\S]*?}\)\)/g, '');
  
  // Try to parse as HTML first (only in browser)
  let text = cleanedHtml;
  
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanedHtml, 'text/html');
      text = doc.body.innerText || doc.body.textContent || cleanedHtml;
    } catch (e) {
      text = cleanedHtml;
    }
  } else {
    // Server-side: strip HTML tags for text extraction
    text = cleanedHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  // Additional cleanup - remove any remaining script-like content
  text = text.replace(/function\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  text = text.replace(/window\["__f__[\s\S]*?/g, '');
  
  console.log('Parsing directory data - text length:', text.length);
  console.log('First 1000 chars:', text.substring(0, 1000));
  
  // Extract verified users - pattern: "Name (phone) email First Seen: date Last Seen: date Location"
  const verifiedUsers: ParsedDirectoryData['verifiedUsers'] = [];
  
  // Find the Verified Users section - look for "Users" heading followed by user data
  // The section might start with "Users" or "Verified users" or "check badge icon Users"
  // Also check for table headers like "Name Phone # Email First Seen Last Seen Country"
  const verifiedUsersSection = text.match(/(?:check\s+badge\s+icon\s+)?Users[\s\S]*?(?=Deactivated|contacts\s+icon|Rate|Dispatch|FMCSA|Address|Privacy|$)/i) ||
                                text.match(/Verified\s+users[\s\S]*?(?=Deactivated|contacts|Rate|Dispatch|FMCSA|Address|$)/i) ||
                                text.match(/Name\s+Phone\s+#\s+Email\s+First\s+Seen\s+Last\s+Seen\s+Country[\s\S]*?(?=Deactivated|contacts\s+icon|Rate|Dispatch|FMCSA|Address|Privacy|$)/i);
  
  console.log('Verified users section found:', !!verifiedUsersSection);
  if (verifiedUsersSection) {
    const usersText = verifiedUsersSection[0];
    console.log('Users text length:', usersText.length);
    console.log('Users text preview:', usersText.substring(0, 500));
  
  // Pattern for verified users with full details
    // Example from user: "ODILJON SHARIPOV (708) 252-2371 alistarincoh@gmail.com 10/5/22 at 11:16am Reston, Virginia 8/5/25 at 2:56pm Chicago, Illinois Uzbekistan"
    // The format is: Name (phone) email First Seen date/time location Last Seen date/time location Country
    // Try multiple patterns to handle different formats
    
    // Pattern 1: Full format with both locations and country
    const verifiedUserPattern1 = /([A-Z][A-Z\s]+?)\s+\((\d{3})\)\s*(\d{3})[\s.-](\d{4})\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:am|pm)?)\s+([^,\n]+?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:am|pm)?)\s+([^,\n]+?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
  let userMatch;
    while ((userMatch = verifiedUserPattern1.exec(usersText)) !== null) {
    verifiedUsers.push({
      name: userMatch[1].trim(),
      phone: `(${userMatch[2]}) ${userMatch[3]}-${userMatch[4]}`,
      email: userMatch[5],
      firstSeen: `${userMatch[6]} at ${userMatch[7]}`,
        lastSeen: `${userMatch[10]} at ${userMatch[11]}`,
        location: `${userMatch[8].trim()}, ${userMatch[9]} / ${userMatch[12].trim()}, ${userMatch[13]}`,
        country: userMatch[14],
      status: 'Verified',
    });
  }
    
    // Pattern 2: Parse table format where each field is on a separate line
    // The table format has: Name on one line, Phone on next, Email on next, etc.
    if (verifiedUsers.length === 0) {
      // Split by lines and look for patterns where we have:
      // - A line with all caps name (like "ODILJON SHARIPOV")
      // - Followed by a phone number line
      // - Followed by an email line
      // - Followed by date lines
      // - Followed by location lines
      // - Followed by country line
      
      const lines = usersText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Skip header lines (Name, Phone #, Email, etc.)
      let startIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^Name\s+Phone/i) || lines[i].match(/^Phone\s+#/i)) {
          startIdx = i + 1;
          break;
        }
      }
      
      // Now parse user data - each user takes multiple lines
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this looks like a name (all caps, multiple words)
        if (line.match(/^[A-Z][A-Z\s]{3,}$/) && !line.match(/^(Name|Phone|Email|First|Last|Country|Verified|Deactivated)/i)) {
          // This might be a user name - try to extract the full user record
          let name = line;
          let phone: string | undefined;
          let email: string | undefined;
          let firstSeen: string | undefined;
          let lastSeen: string | undefined;
          let locations: string[] = [];
          let country: string | undefined;
          
          // Look ahead for phone, email, dates, locations, country
          let j = i + 1;
          while (j < lines.length && j < i + 10) { // Look up to 10 lines ahead
            const nextLine = lines[j];
            
            // Phone number
            if (!phone && nextLine.match(/^\(?\d{3}\)?\s*\d{3}[\s.-]\d{4}/)) {
              phone = nextLine.replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
            }
            // Email
            else if (!email && nextLine.match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+$/)) {
              email = nextLine;
            }
            // First Seen date
            else if (!firstSeen && nextLine.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+at\s+\d{1,2}:\d{2}(?:am|pm)?/)) {
              firstSeen = nextLine;
            }
            // Location (City, State format)
            else if (nextLine.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}$/)) {
              locations.push(nextLine);
            }
            // Last Seen date
            else if (!lastSeen && nextLine.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+at\s+\d{1,2}:\d{2}(?:am|pm)?/)) {
              lastSeen = nextLine;
            }
            // Country (single word, capitalized)
            else if (!country && nextLine.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/) && 
                     !nextLine.match(/^(Name|Phone|Email|First|Last|Country|Verified|Deactivated|Current|Inactive|Physical|Mailing)/i) &&
                     !nextLine.match(/,\s*[A-Z]{2}$/)) { // Not a location
              country = nextLine;
            }
            // Stop if we hit another name (next user) or section header
            else if (nextLine.match(/^[A-Z][A-Z\s]{3,}$/) && nextLine !== name) {
              break;
            }
            
            j++;
          }
          
          // If we found at least name and phone or email, it's a valid user
          if (name && (phone || email)) {
            verifiedUsers.push({
              name: name.trim(),
              phone,
              email,
              firstSeen,
              lastSeen,
              location: locations.length > 0 ? locations.join(' / ') : undefined,
              country,
              status: 'Verified',
            });
            
            // Skip the lines we just processed
            i = j - 1;
          }
        }
      }
      
      console.log('Parsed users from table format:', verifiedUsers.length);
    }
    
    // Fallback: pattern without country
    if (verifiedUsers.length === 0) {
      const userPatternNoCountry = /([A-Z][A-Z\s]+?)\s+\((\d{3})\)\s*(\d{3})[\s.-](\d{4})\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:am|pm)?)\s+([^,\n]+?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:am|pm)?)\s+([^,\n]+?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
      let userMatch2;
      while ((userMatch2 = userPatternNoCountry.exec(usersText)) !== null) {
        verifiedUsers.push({
          name: userMatch2[1].trim(),
          phone: `(${userMatch2[2]}) ${userMatch2[3]}-${userMatch2[4]}`,
          email: userMatch2[5],
          firstSeen: `${userMatch2[6]} at ${userMatch2[7]}`,
          lastSeen: `${userMatch2[10]} at ${userMatch2[11]}`,
          location: `${userMatch2[8].trim()}, ${userMatch2[9]} / ${userMatch2[12].trim()}, ${userMatch2[13]}`,
          status: 'Verified',
        });
      }
    }
  
  // Fallback: simpler pattern for users without all details
  if (verifiedUsers.length === 0) {
      const simpleUserPattern = /([A-Z][A-Z\s]+?)\s+\((\d{3})\)\s*(\d{3})[\s.-](\d{4})\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    let simpleMatch;
      while ((simpleMatch = simpleUserPattern.exec(usersText)) !== null) {
      verifiedUsers.push({
        name: simpleMatch[1].trim(),
        phone: `(${simpleMatch[2]}) ${simpleMatch[3]}-${simpleMatch[4]}`,
        email: simpleMatch[5],
        status: 'Verified',
      });
      }
    }
  }
  
  if (verifiedUsers.length > 0) {
    data.verifiedUsers = verifiedUsers;
  }
  
  // Extract deactivated users
  const deactivatedUsers: ParsedDirectoryData['deactivatedUsers'] = [];
  const deactivatedSectionMatch = text.match(/Deactivated\s+Users[^\n]*\n([\s\S]*?)(?=contacts|FMCSA|Address|$)/i);
  if (deactivatedSectionMatch && !deactivatedSectionMatch[1].includes('No records found')) {
    // Extract deactivated user details if present
    const deactivatedUserPattern = /([A-Z][A-Z\s]+)\s+\((\d{3})\)\s*(\d{3})[\s.-](\d{4})(?:\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+))?/g;
    let deactivatedMatch;
    while ((deactivatedMatch = deactivatedUserPattern.exec(deactivatedSectionMatch[1])) !== null) {
      deactivatedUsers.push({
        name: deactivatedMatch[1].trim(),
        phone: `(${deactivatedMatch[2]}) ${deactivatedMatch[3]}-${deactivatedMatch[4]}`,
        email: deactivatedMatch[5] || undefined,
        status: 'Deactivated',
      });
    }
  }
  
  if (deactivatedUsers.length > 0) {
    data.deactivatedUsers = deactivatedUsers;
  }
  
  // Extract contacts - pattern: "Role Name Phone Email Created"
  const contacts: ParsedDirectoryData['contacts'] = [];
  
  // Find the Contacts section - look for "contacts icon Contacts" or just "Contacts"
  // Also look for table headers like "Role Name Phone # Email Created"
  const contactsSection = text.match(/contacts\s+icon\s+Contacts[\s\S]*?(?=contacts\s+icon\s+Rate|Dispatch|FMCSA|Address|Privacy|$)/i) ||
                          text.match(/^Contacts[\s\S]*?(?=Rate|Dispatch|FMCSA|Address|Privacy|$)/im) ||
                          text.match(/Role\s+Name\s+Phone\s+#\s+Email\s+Created[\s\S]*?(?=contacts\s+icon\s+Rate|Dispatch|FMCSA|Address|Privacy|$)/i);
  
  console.log('Contacts section found:', !!contactsSection);
  if (contactsSection) {
    const contactsText = contactsSection[0];
    console.log('Contacts text length:', contactsText.length);
    console.log('Contacts text preview:', contactsText.substring(0, 500));
  
  // Pattern for contacts with role, name, phone, email, created date
    // Example: "Billing ALISHER NASIROV (800) 327-1124 dispatch@alistarincoh.com 9/29/24 at 7:22pm"
    const contactPattern = /(Billing|Dispatch|Claims)\s+([A-Z][A-Z\s]+?)\s+\((\d{3})\)\s*(\d{3})[\s.-](\d{4})\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:am|pm)?)/gi;
  let contactMatch;
    while ((contactMatch = contactPattern.exec(contactsText)) !== null) {
    contacts.push({
      role: contactMatch[1],
      name: contactMatch[2].trim(),
      phone: `(${contactMatch[3]}) ${contactMatch[4]}-${contactMatch[5]}`,
      email: contactMatch[6],
      created: `${contactMatch[7]} at ${contactMatch[8]}`,
    });
  }
  
    // Fallback: Parse table format where each field is on a separate line
  if (contacts.length === 0) {
      const lines = contactsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Skip header lines
      let startIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^Role\s+Name/i) || lines[i].match(/^Name\s+Phone/i)) {
          startIdx = i + 1;
          break;
        }
      }
      
      // Parse contact data - each contact takes multiple lines
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this looks like a role (Billing, Dispatch, Claims)
        if (line.match(/^(Billing|Dispatch|Claims)$/i)) {
          const role = line;
          let name: string | undefined;
          let phone: string | undefined;
          let email: string | undefined;
          let created: string | undefined;
          
          // Look ahead for name, phone, email, created
          let j = i + 1;
          while (j < lines.length && j < i + 6) {
            const nextLine = lines[j];
            
            // Name (all caps, multiple words)
            if (!name && nextLine.match(/^[A-Z][A-Z\s]{3,}$/)) {
              name = nextLine;
            }
            // Phone number
            else if (!phone && nextLine.match(/^\(?\d{3}\)?\s*\d{3}[\s.-]\d{4}/)) {
              phone = nextLine.replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
            }
            // Email
            else if (!email && nextLine.match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+$/)) {
              email = nextLine;
            }
            // Created date
            else if (!created && nextLine.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+at\s+\d{1,2}:\d{2}(?:am|pm)?/)) {
              created = nextLine;
            }
            // Stop if we hit another role (next contact) or section header
            else if (nextLine.match(/^(Billing|Dispatch|Claims)$/i) && nextLine !== role) {
              break;
            }
            
            j++;
          }
          
          // If we found at least role and name, it's a valid contact
          if (role && name && (phone || email)) {
      contacts.push({
              role,
              name: name.trim(),
              phone,
              email,
              created,
            });
            
            // Skip the lines we just processed
            i = j - 1;
          }
        }
      }
      
      console.log('Parsed contacts from table format:', contacts.length);
    }
  }
  
  if (contacts.length > 0) {
    data.contacts = contacts;
  }
  
  // Extract addresses - both Physical and Mailing
  const addresses: ParsedDirectoryData['addresses'] = [];
  
  // Find the Addresses section
  const addressesSection = text.match(/Addresses[\s\S]*?(?=Privacy|Terms|Help|©|$)/i);
  if (addressesSection) {
    const addrText = addressesSection[0];
  
  // Pattern for addresses with type, full address, status, and first seen date
  // Example: "Physical Address Current 9435 Waterstone Blvd, Ste 140 Cincinnati, OH 45249 First Seen: 08/14/24"
    // More flexible pattern that handles line breaks and variations
  const addressPattern = /(Physical|Mailing)\s+Address\s+(Current|Inactive)\s+([^\n]+?)\s+First\s+Seen:\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
  let addrMatch;
    while ((addrMatch = addressPattern.exec(addrText)) !== null) {
      const fullAddrText = addrMatch[3].trim();
      // Parse address components - handle cases with/without commas
      // Pattern: "Street, City, State ZIP" or "Street City, State ZIP"
      const addrParts = fullAddrText.match(/(.+?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/) ||
                       fullAddrText.match(/(.+?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/);
    if (addrParts) {
      addresses.push({
        type: addrMatch[1],
        address: addrParts[1].trim(),
        city: addrParts[2].trim(),
        state: addrParts[3].trim(),
        zip: addrParts[4].trim(),
        status: addrMatch[2],
        firstSeen: addrMatch[4],
      });
    } else {
      // Fallback: just store the full address string
      addresses.push({
        type: addrMatch[1],
          address: fullAddrText,
        status: addrMatch[2],
        firstSeen: addrMatch[4],
      });
    }
  }
  
  // Fallback: simpler address pattern without "First Seen"
  if (addresses.length === 0) {
    const simpleAddrPattern = /(Physical|Mailing)\s+Address\s+(Current|Inactive)\s+([^\n]+)/gi;
    let simpleAddrMatch;
      while ((simpleAddrMatch = simpleAddrPattern.exec(addrText)) !== null) {
        const fullAddrText = simpleAddrMatch[3].trim();
        const addrParts = fullAddrText.match(/(.+?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/) ||
                         fullAddrText.match(/(.+?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/);
      if (addrParts) {
        addresses.push({
          type: simpleAddrMatch[1],
          address: addrParts[1].trim(),
          city: addrParts[2].trim(),
          state: addrParts[3].trim(),
          zip: addrParts[4].trim(),
          status: simpleAddrMatch[2],
        });
      } else {
        addresses.push({
          type: simpleAddrMatch[1],
            address: fullAddrText,
          status: simpleAddrMatch[2],
        });
        }
      }
    }
  }
  
  if (addresses.length > 0) {
    data.addresses = addresses;
  }
  
  // Extract Rate Confirmation Emails
  const rateConfirmationEmails: ParsedDirectoryData['rateConfirmationEmails'] = [];
  const rateEmailSection = text.match(/contacts\s+icon\s+Rate\s+Confirmation\s+Emails[\s\S]*?(?=dispatch\s+services|FMCSA|Address|Privacy|$)/i) ||
                           text.match(/Rate\s+Confirmation\s+Emails[\s\S]*?(?=Dispatch|FMCSA|Address|Privacy|$)/i);
  if (rateEmailSection) {
    const rateEmailText = rateEmailSection[0];
    // Pattern: "Email Alias Description" or just "Email"
    // Example: "dot3396687@highway.com - -"
    const rateEmailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)(?:\s+([^\n-]+?))?(?:\s+([^\n]+?))?(?=\n|$)/gi;
    let emailMatch;
    while ((emailMatch = rateEmailPattern.exec(rateEmailText)) !== null) {
      const alias = emailMatch[2]?.trim();
      const description = emailMatch[3]?.trim();
      rateConfirmationEmails.push({
        email: emailMatch[1],
        alias: alias && alias !== '-' ? alias : undefined,
        description: description && description !== '-' ? description : undefined,
      });
    }
    
    // Fallback: simpler pattern - just find emails in the section
    if (rateConfirmationEmails.length === 0) {
      const simpleEmailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
      let simpleEmailMatch;
      while ((simpleEmailMatch = simpleEmailPattern.exec(rateEmailText)) !== null) {
        // Skip if it's in a different section (like in user emails)
        if (!rateEmailText.substring(0, simpleEmailMatch.index).includes('Rate Confirmation')) {
          continue;
        }
        rateConfirmationEmails.push({
          email: simpleEmailMatch[1],
      });
      }
    }
  }
  
  if (rateConfirmationEmails.length > 0) {
    data.rateConfirmationEmails = rateConfirmationEmails;
  }
  
  // Extract Dispatch Services
  const dispatchServices: ParsedDirectoryData['dispatchServices'] = [];
  const dispatchSection = text.match(/Dispatch\s+Services[^\n]*\n([\s\S]*?)(?=FMCSA|Address|$)/i);
  if (dispatchSection && !dispatchSection[1].includes('No records found')) {
    // Try to extract dispatch service names
    const dispatchNamePattern = /([A-Z][A-Z\s&,.-]+(?:INC|LLC|CORP|LTD|CO|COMPANY)?)/g;
    let dispatchMatch;
    while ((dispatchMatch = dispatchNamePattern.exec(dispatchSection[1])) !== null) {
      dispatchServices.push({
        name: dispatchMatch[1].trim(),
      });
    }
  }
  
  if (dispatchServices.length > 0) {
    data.dispatchServices = dispatchServices;
  }
  
  // Extract FMCSA Information
  // Note: The user mentioned "You are not authorized to view FMCSA contact information"
  // So we'll check if this message appears
  const fmcsaInfo: ParsedDirectoryData['fmcsaInfo'] = {};
  
  if (text.match(/You are not authorized to view FMCSA/i)) {
    // FMCSA info is restricted
    fmcsaInfo.restricted = true;
    fmcsaInfo.names = [];
    fmcsaInfo.phones = [];
    fmcsaInfo.emails = [];
    fmcsaInfo.addresses = [];
  } else {
    fmcsaInfo.restricted = false;
    // Try to extract FMCSA names, phones, emails, addresses if available
    const fmcsaNamesSection = text.match(/FMCSA[^\n]*Names[^\n]*\n([\s\S]*?)(?=Phones|Emails|Addresses|$)/i);
    if (fmcsaNamesSection) {
      const names = fmcsaNamesSection[1].split(/\n/).map(n => n.trim()).filter(n => n && !n.match(/^[A-Z\s]+$/));
      if (names.length > 0) {
        fmcsaInfo.names = names;
      }
    }
    
    const fmcsaPhonesSection = text.match(/FMCSA[^\n]*Phones[^\n]*\n([\s\S]*?)(?=Emails|Addresses|$)/i);
    if (fmcsaPhonesSection) {
      const phones = fmcsaPhonesSection[1].match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || [];
      if (phones.length > 0) {
        fmcsaInfo.phones = phones;
      }
    }
    
    const fmcsaEmailsSection = text.match(/FMCSA[^\n]*Emails[^\n]*\n([\s\S]*?)(?=Addresses|$)/i);
    if (fmcsaEmailsSection) {
      const emails = fmcsaEmailsSection[1].match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g) || [];
      if (emails.length > 0) {
        fmcsaInfo.emails = emails;
      }
    }
    
    const fmcsaAddressesSection = text.match(/FMCSA[^\n]*Addresses[^\n]*\n([\s\S]*?)(?=$)/i);
    if (fmcsaAddressesSection) {
      const addresses = fmcsaAddressesSection[1].split(/\n/).map(a => a.trim()).filter(a => a && a.length > 10);
      if (addresses.length > 0) {
        fmcsaInfo.addresses = addresses;
      }
    }
  }
  
  if (Object.keys(fmcsaInfo).length > 0) {
    data.fmcsaInfo = fmcsaInfo;
  }
  
  return data;
}

/**
 * Extract carrier URL from text
 */
export function extractCarrierUrl(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/highway\.com\/broker\/carriers\/(\d+)/i) ||
                   text.match(/highway\.com\/broker\/carriers\/(\d+)/i);
  if (urlMatch) {
    return `https://highway.com/broker/carriers/${urlMatch[1]}`;
  }
  return null;
}

/**
 * Extract carrier ID from URL
 */
export function extractCarrierId(url: string): string | null {
  const match = url.match(/\/carriers\/(\d+)/);
  return match ? match[1] : null;
}

