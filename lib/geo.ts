export function splitCityState(s?: string | null) {
  if (!s) return { city: null, state: null };
  const m = s.trim().toUpperCase().match(/^(.+),\s*([A-Z]{2})$/);
  if (!m) return { city: s.trim(), state: null };
  return { city: m[1].trim(), state: m[2] };
}

// From a telegram_bids.stops JSON array like ["PALMETTO, GA", "OPA LOCKA, FL"]
export function originDestFromStops(stops?: string[] | null) {
  const arr = Array.isArray(stops) ? stops.filter(Boolean) : [];
  if (arr.length === 0) return { origin: null, dest: null };
  return { origin: arr[0], dest: arr[arr.length - 1] };
}
