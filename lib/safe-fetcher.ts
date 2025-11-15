/**
 * Safe fetcher for SWR and fetch calls
 * Handles non-JSON responses gracefully (e.g., HTML error pages)
 */

export async function safeFetcher(url: string) {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Check if response is actually JSON before parsing
    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      // Response is not JSON (probably HTML error page)
      console.warn(`[SafeFetcher] Non-JSON response from ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        contentType,
      });
      
      // Return a safe error structure
      return {
        error: `Server returned ${response.status} ${response.statusText}`,
        data: null,
        status: response.status,
      };
    }

    // Parse JSON only if content-type is correct
    const data = await response.json();
    
    if (!response.ok) {
      return {
        error: data.error || `Request failed with status ${response.status}`,
        data: null,
        status: response.status,
      };
    }

    return data;
  } catch (error: unknown) {
    console.error(`[SafeFetcher] Error fetching ${url}:`, error);
    return {
      error: error instanceof Error ? error.message : 'Network error',
      data: null,
      status: 0,
    };
  }
}

/**
 * Simple fetcher that throws on error (for SWR)
 */
export const swrFetcher = async (url: string) => {
  const result = await safeFetcher(url);
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result.data || result;
};



