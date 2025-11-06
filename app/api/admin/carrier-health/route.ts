import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const API_BASE = "https://staging.highway.com/core/connect/external_api/v1";

function getApiKey(): string {
  const apiKey = process.env.HIGHWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "HIGHWAY_API_KEY environment variable is not set. " +
      "Please add HIGHWAY_API_KEY to your .env.local file with your Highway API key."
    );
  }
  // Remove any spaces from the key (in case it was copied with spaces)
  return apiKey.replace(/\s/g, "");
}

function getHeaders(): Record<string, string> {
  const apiKey = getApiKey();
  // Return headers matching Python requests library format exactly
  // Python requests normalizes headers to title-case
  // Some APIs are picky about header casing, so let's match Python exactly
  // Ensure Bearer has exactly one space and no extra whitespace
  const authHeader = `Bearer ${apiKey.trim()}`;
  
  // Ensure no extra spaces or encoding issues
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Authorization": authHeader,
    "User-Agent": "HighwayScorecard/1.7",
  };
  
  // Debug: log the exact Authorization header format (first 50 chars only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Highway API] Authorization header format:', {
      length: authHeader.length,
      startsWithBearer: authHeader.startsWith('Bearer '),
      spaceAfterBearer: authHeader[6] === ' ',
      keyLength: apiKey.length,
      keyFirstChars: apiKey.substring(0, 20) + '...',
    });
  }
  
  return headers;
}

interface HighwayError extends Error {
  statusCode?: number;
}

class HighwayAPIError extends Error implements HighwayError {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HighwayAPIError";
  }
}

function digits(s: string): string {
  return s.replace(/[^\d]/g, "");
}

function fmtCandidates(mcDigits: string): string[] {
  const base = mcDigits;
  const nozero = mcDigits.replace(/^0+/, "") || mcDigits;
  const padded = mcDigits.padStart(6, "0");
  const forms = [base, nozero, padded];
  return [...new Set(forms)]; // dedupe, keep order
}

async function carrierIdByMC(mc: string): Promise<number | null> {
  const mcDigits = digits(mc);
  if (!mcDigits) return null;

  const forms = fmtCandidates(mcDigits);

  async function tryRequest(url: string, params?: Record<string, string>): Promise<{ id: number | null; data: any }> {
    try {
      const queryString = params ? "?" + new URLSearchParams(params).toString() : "";
      const headers = getHeaders();
      const fullUrl = url + queryString;
      
      // Debug logging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Highway API] Request:', {
          url: fullUrl,
          method: 'GET',
          hasAuthHeader: !!headers.Authorization,
          authHeaderPrefix: headers.Authorization?.substring(0, 30) + '...',
          userAgent: headers['User-Agent'],
          allHeaders: Object.keys(headers),
        });
      }
      
      // Use axios which more closely matches Python requests library behavior
      // Since the JWT is valid, there must be something else Highway checks
      // Let's try to match Python requests EXACTLY
      const response = await axios.get(fullUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': headers.Authorization,
          'User-Agent': headers['User-Agent'],
        },
        maxRedirects: 5,
        timeout: 30000,
        validateStatus: (status) => true,
        decompress: true,
        // Add these to match Python requests behavior more closely
        httpAgent: undefined, // Let axios use default
        httpsAgent: undefined, // Let axios use default
        // Try to match Python's SSL/TLS behavior
        withCredentials: false,
      });
      
      // Debug response
      if (process.env.NODE_ENV === 'development') {
        console.log('[Highway API] Response:', {
          status: response.status,
          statusText: response.statusText,
          url: fullUrl,
          headers: response.headers,
        });
      }

      if (response.status === 401) {
        console.error('[Highway API] 401 Unauthorized:', {
          url: fullUrl,
          responseText: typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data).substring(0, 500),
          authHeaderPresent: !!headers.Authorization,
          responseHeaders: response.headers,
        });
        
        // Check if API key is inactive by decoding JWT
        let keyStatus = '';
        try {
          const apiKey = getApiKey();
          const parts = apiKey.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            if (payload.is_active === false) {
              keyStatus = '\n\n⚠️  CRITICAL: The API key has is_active: false in the JWT payload!\n' +
                         '   This means the key is INACTIVE in Highway\'s system.\n' +
                         '   You need to log into Highway portal and ACTIVATE the key.\n';
            }
          }
        } catch (e) {
          // Ignore JWT decode errors
        }
        
        // Provide detailed error message with troubleshooting steps
        const errorMessage = `401 Unauthorized from Highway API${keyStatus}

The API key JWT is valid (not expired), but Highway is rejecting requests.

Most likely cause: The API key is INACTIVE (is_active: false in JWT payload).

To fix:
1. Log into https://staging.highway.com with your Highway account
2. Go to API Key settings (Settings → API Keys, Developer → API Access, etc.)
3. Find your API key and ACTIVATE it, or generate a new active key
4. Update HIGHWAY_API_KEY in .env.local with the active key
5. Restart the server

Request details:
- URL: ${fullUrl}
- Method: GET
- Authorization header present: ${!!headers.Authorization}
- User-Agent: ${headers['User-Agent']}

If activation doesn't work, contact Highway support: implementations@highway.com`;

        throw new HighwayAPIError(errorMessage, 401);
      }
      if (response.status >= 400) {
        const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new HighwayAPIError(`HTTP ${response.status}: ${errorText.substring(0, 700)}`, response.status);
      }

      const data = response.data;

      if (typeof data === "object" && data !== null && "id" in data) {
        return { id: parseInt(String(data.id)), data };
      }

      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        if (typeof item === "object" && item !== null && "id" in item) {
          return { id: parseInt(String(item.id)), data: { list_first: item } };
        }
      }

      if (typeof data === "object" && data !== null) {
        const items = (data as any).carriers || (data as any).results || [];
        if (Array.isArray(items) && items.length > 0) {
          const item = items[0];
          if (typeof item === "object" && item !== null && "id" in item) {
            return { id: parseInt(String(item.id)), data };
          }
        }
      }

      return { id: null, data };
    } catch (error: any) {
      if (error instanceof HighwayAPIError) throw error;
      return { id: null, data: null };
    }
  }

  // 1) by_identifier variants
  for (const token of forms) {
    for (const path of [
      `${API_BASE}/carriers/MC/${token}/by_identifier`,
      `${API_BASE}/carriers/MC${token}/by_identifier`,
      `${API_BASE}/carriers/MC%20${token}/by_identifier`,
    ]) {
      const result = await tryRequest(path);
      if (result.id !== null) {
        return result.id;
      }
    }
  }

  // 2) exact-value filters
  const searchParamsList = [
    { "q[identifiers_value_eq]": mcDigits, "q[identifiers_is_type_eq]": "MC", "q[s]": "id desc" },
    { "q[identifiers_value_eq]": `MC${mcDigits}`, "q[identifiers_is_type_eq]": "MC", "q[s]": "id desc" },
    { "q[identifiers_value_eq]": mcDigits, "q[s]": "id desc" },
    { "q[identifiers_value_cont]": mcDigits, "q[identifiers_is_type_eq]": "MC", "q[s]": "id desc" },
  ];

  for (const params of searchParamsList) {
    const result = await tryRequest(`${API_BASE}/carriers`, params);
    if (result.id !== null) {
      return result.id;
    }
  }

  // 3) last-ditch: very broad contains search
  const result = await tryRequest(`${API_BASE}/carriers`, {
    "q[identifiers_value_cont]": mcDigits,
    "q[s]": "id desc",
  });

  return result.id;
}

async function carrierDetail(carrierId: number): Promise<any> {
  const headers = getHeaders();
  const url = `${API_BASE}/carriers/${carrierId}`;
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Highway API] Carrier Detail Request:', {
      url,
      method: 'GET',
      hasAuthHeader: !!headers.Authorization,
      authHeaderPrefix: headers.Authorization?.substring(0, 20) + '...',
    });
  }
  
  // Use axios which more closely matches Python requests library behavior
  const response = await axios.get(url, {
    headers: {
      'Accept': 'application/json',  // Python requests uses title-case
      'Authorization': headers.Authorization,  // title-case as shown in Highway docs
      'User-Agent': headers['User-Agent'],
    },
    maxRedirects: 5,
    timeout: 30000,
    validateStatus: (status) => true, // Don't throw on any status, we'll handle it
  });
  
  // Debug response
  if (process.env.NODE_ENV === 'development') {
    console.log('[Highway API] Carrier Detail Response:', {
      status: response.status,
      statusText: response.statusText,
      url,
    });
  }

  if (response.status === 401) {
    const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    console.error('[Highway API] 401 Unauthorized (carrierDetail):', {
      url,
      responseText: responseText.substring(0, 500),
      authHeaderPresent: !!headers.Authorization,
      responseHeaders: response.headers,
    });
    throw new HighwayAPIError(
      "401 Unauthorized — The Highway API key is invalid or expired. " +
      "Please check your HIGHWAY_API_KEY in .env.local and ensure it's a valid staging API key.",
      401
    );
  }
  if (response.status >= 400) {
    const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    throw new HighwayAPIError(`HTTP ${response.status}: ${errorText.substring(0, 700)}`, response.status);
  }

  return response.data;
}

function pick(obj: any, path: string, defaultValue: any = null): any {
  let current = obj;
  const parts = path.split(".");

  for (const part of parts) {
    if (part.includes("[") && part.endsWith("]")) {
      const [name, indexStr] = part.split("[");
      const index = parseInt(indexStr.replace("]", ""));
      if (typeof current !== "object" || current === null || !(name in current)) {
        return defaultValue;
      }
      current = current[name];
      if (!Array.isArray(current) || index < 0 || index >= current.length) {
        return defaultValue;
      }
      current = current[index];
    } else {
      if (typeof current !== "object" || current === null || !(part in current)) {
        return defaultValue;
      }
      current = current[part];
    }
  }
  return current;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  try {
    const date = new Date(s);
    if (isNaN(date.getTime())) return s;
    return date.toISOString().split("T")[0];
  } catch {
    return s;
  }
}

function ageText(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d0 = new Date(fmtDate(dateStr));
    const d1 = new Date();
    const months = (d1.getFullYear() - d0.getFullYear()) * 12 + (d1.getMonth() - d0.getMonth());
    const years = Math.floor(months / 12);
    const mths = months % 12;
    if (months < 0) return "";
    return `${years} ${years === 1 ? "yr" : "yrs"} ${mths} ${mths === 1 ? "mth" : "mths"}`;
  } catch {
    return "";
  }
}

function pct(numer: number | null | undefined, denom: number | null | undefined): string {
  try {
    const n = parseFloat(String(numer || 0));
    const d = parseFloat(String(denom || 0));
    if (d <= 0) return "0";
    return String(Math.round((100 * n) / d * 100) / 100);
  } catch {
    return "0";
  }
}

function basicsWithPercent(detail: any): Record<string, string> {
  const basicsList = pick(detail, "safety.sms_basics", []) || [];
  const idx: Record<string, any> = {};
  for (const b of basicsList) {
    if (b && b.is_type) {
      idx[b.is_type] = b;
    }
  }

  const latest = pick(detail, "safety.latest_sms_basic", {}) || {};

  function lab(isType: string, pkey: string, okey: string): string {
    const b = idx[isType] || {};
    let p = b.percentile;
    let over = b.over_threshold;

    if (p === null || p === undefined) {
      p = latest[pkey];
      if (typeof p === "number" && p <= 1) {
        p *= 100.0;
      }
    }
    if (over === null || over === undefined) {
      over = latest[okey];
    }

    if (p === null && over === null) {
      return "";
    }

    // Python uses double space: "OVER  NN%" or "OK  NN%"
    const tag = over === true ? "OVER" : over === false ? "OK" : "";
    const ptxt = p !== null && p !== undefined 
      ? `${String(Math.round(p * 100) / 100).replace(/\.?0+$/, "")}%` 
      : "";
    return `${tag}  ${ptxt}`.trim();  // Double space like Python
  }

  return {
    "Driver Fitness 80% Limit": lab("driver_fitness", "driver_fitness_percentile", "driver_fitness_over_threshold"),
    "HOS-65% Limit": lab("hours_of_service_compliance", "hos_compliance_percentile", "hos_compliance_over_threshold"),
    "Drug & Alcohol-0% Limit": lab("controlled_substances_and_alcohol", "substance_alcohol_percentile", "substance_alcohol_over_threshold"),
    "Unsafe Driving-65% Limit": lab("unsafe_driving", "unsafe_driving_percentile", "unsafe_driving_over_threshold"),
    "Vehicle Maintenance-80% Limit": lab("vehicle_maintenance", "vehicle_maintenance_percentile", "vehicle_maintenance_over_threshold"),
  };
}

function buildHealthData(detail: any): any {
  const basics = basicsWithPercent(detail);

  // Crash Indicator - Python uses double space: "OVER  NN%"
  const ci = pick(detail, "latest_bluewire.crash_score");
  let crashIndicator = "";
  if (ci !== null && ci !== undefined) {
    try {
      const p = parseFloat(String(ci));
      const tag = p >= 65 ? "OVER" : "OK";
      const ptxt = String(Math.round(p * 100) / 100).replace(/\.?0+$/, "");
      crashIndicator = `${tag}  ${ptxt}%`;  // Double space like Python
    } catch {}
  }

  // BlueWire Score
  const bw = pick(detail, "latest_bluewire.bluewire_score");
  let bluewireScore = "";
  if (bw !== null && bw !== undefined) {
    try {
      bluewireScore = String(Math.round(parseFloat(String(bw)) * 100) / 100).replace(/\.?0+$/, "");
    } catch {
      bluewireScore = String(bw);
    }
  }

  // Inspections
  const ins = detail.inspections || {};
  const drvTotal = ins.driver_fitness_inspections || 0;
  const drvOos = ins.driver_fitness_oos_inspections || 0;
  const vehTotal = ins.vehicle_maintenance_inspections || 0;
  const vehOos = ins.vehicle_maintenance_oos_inspections || 0;

  // FMCSA dates - Python checks multiple fallback dates
  const fmcsaOriginal = pick(detail, "authority.authorities.original_authority_grant_date_common") ||
                        pick(detail, "authority.authorities.original_authority_grant_date_contract") ||
                        pick(detail, "authority.authorities.original_authority_grant_date_broker");
  const fmcsaContinuous = pick(detail, "authority.authorities.continuous_authority_grant_date_common");
  const fmcsaDate = fmcsaOriginal || fmcsaContinuous || 
                    pick(detail, "operations.mcs150_form_date") || "";

  return {
    carrierName: detail.legal_name || detail.dba_name || "",
    totalCrashes24Months: pick(detail, "crashes.total", ""),
    mcs150PowerUnits: pick(detail, "operations.total_power_units", ""),
    highwayObservedUnits: pick(detail, "equipment.summary.total_observed_power_units", ""),
    inspectionCount: ins.total_inspections || "",
    fmcsaDate: fmtDate(fmcsaDate),
    authorityAge: ageText(fmcsaDate),
    oosGaps: fmcsaOriginal && fmcsaContinuous && fmtDate(fmcsaOriginal) !== fmtDate(fmcsaContinuous) ? "Yes" : "No",
    crashIndicator: crashIndicator || "",
    driverFitness: basics["Driver Fitness 80% Limit"] || "",
    hos: basics["HOS-65% Limit"] || "",
    drugAlcohol: basics["Drug & Alcohol-0% Limit"] || "",
    unsafeDriving: basics["Unsafe Driving-65% Limit"] || "",
    vehicleMaintenance: basics["Vehicle Maintenance-80% Limit"] || "",
    oosDriverFitness: pct(drvOos, drvTotal),
    oosVehiclesFitness: pct(vehOos, vehTotal),
    bluewireScore: bluewireScore || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    // Check if API key is configured
    let apiKey: string;
    try {
      apiKey = getApiKey();
    } catch (error: any) {
      return NextResponse.json(
        { 
          ok: false, 
          error: error.message || "HIGHWAY_API_KEY is not configured",
          details: "Please add HIGHWAY_API_KEY to your .env.local file. Get your API key from Highway staging environment."
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mcNumber = searchParams.get("mc");

    if (!mcNumber) {
      return NextResponse.json(
        { ok: false, error: "MC number is required" },
        { status: 400 }
      );
    }

    // Find carrier ID
    const carrierId = await carrierIdByMC(mcNumber);
    if (!carrierId) {
      return NextResponse.json(
        { ok: false, error: `MC ${mcNumber} not found in Highway database` },
        { status: 404 }
      );
    }

    // Get carrier details
    const detail = await carrierDetail(carrierId);
    const healthData = buildHealthData(detail);

    return NextResponse.json({
      ok: true,
      data: healthData,
    });
    } catch (error: any) {
      console.error("Carrier health API error:", error);
      
      // Provide more specific error messages
      if (error instanceof HighwayAPIError) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            details: error.statusCode === 401 
              ? "The Highway API key is invalid or expired. Please update HIGHWAY_API_KEY in your .env.local file and restart the server."
              : "Highway API request failed. Check your API key configuration."
          },
          { status: error.statusCode || 500 }
        );
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to fetch carrier health data",
          details: "Please check your HIGHWAY_API_KEY configuration and ensure the server has been restarted after adding it."
        },
        { status: error.statusCode || 500 }
      );
    }
}

