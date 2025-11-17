/**
 * Highway Cookie Management
 * Handles automatic cookie sharing between user's browser and Playwright
 */

export interface HighwayCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Bookmarklet code to extract cookies from Highway.com
 * User runs this once on highway.com to extract and store cookies
 */
export const HIGHWAY_COOKIE_BOOKMARKLET = `
javascript:(function(){
  const cookies = document.cookie.split(';').map(c => {
    const [name, ...valueParts] = c.trim().split('=');
    const value = valueParts.join('=');
    const cookieObj = { name, value };
    
    // Try to get additional cookie properties from document.cookie (limited)
    // For full properties, we'd need browser extension, but this works for most cases
    return cookieObj;
  }).filter(c => c.name && c.value);
  
  const cookieData = {
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: '.highway.com',
      path: '/',
      secure: true,
      sameSite: 'Lax'
    })),
    extractedAt: new Date().toISOString(),
    url: window.location.href
  };
  
  // Store in localStorage (will be read by our app)
  localStorage.setItem('highway_cookies', JSON.stringify(cookieData));
  
  // Also try to send directly to our API if possible
  fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/admin/highway-cookies/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cookieData),
    credentials: 'include'
  }).then(() => {
    alert('✅ Highway cookies extracted and stored! You can now use the health check feature.');
  }).catch(() => {
    alert('✅ Cookies stored locally. The app will use them automatically.');
  });
})();
`.trim();

/**
 * Get cookies from localStorage (client-side)
 */
export function getHighwayCookiesFromStorage(): HighwayCookie[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('highway_cookies');
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    return data.cookies || null;
  } catch (error) {
    console.error('Error reading Highway cookies from storage:', error);
    return null;
  }
}

/**
 * Format cookies for Playwright's addCookies method
 */
export function formatCookiesForPlaywright(cookies: HighwayCookie[]): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}> {
  return cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain || '.highway.com',
    path: cookie.path || '/',
    expires: cookie.expires,
    httpOnly: cookie.httpOnly || false,
    secure: cookie.secure !== false, // Default to true for security
    sameSite: cookie.sameSite || 'Lax',
  }));
}

