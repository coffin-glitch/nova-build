import { NextRequest, NextResponse } from "next/server";

/**
 * Content Security Policy (CSP) Implementation
 * Implements OWASP CSP guidelines for Next.js applications
 */

export interface CSPConfig {
  mode: 'strict' | 'moderate' | 'permissive';
  allowInlineScripts?: boolean;
  allowInlineStyles?: boolean;
  allowEval?: boolean;
  trustedDomains?: string[];
  reportUri?: string;
}

/**
 * Generate CSP header based on configuration
 */
export function generateCSP(config: CSPConfig = { mode: 'strict' }): string {
  const {
    mode,
    allowInlineScripts = false,
    allowInlineStyles = false,
    allowEval = false,
    trustedDomains = [],
    reportUri
  } = config;

  const baseDomains = [
    "'self'",
    'https://clerk.com',
    'https://*.clerk.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    ...trustedDomains
  ];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      'https://clerk.com',
      'https://*.clerk.com'
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind CSS
      'https://fonts.googleapis.com'
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'data:'
    ],
    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:'
    ],
    'connect-src': [
      "'self'",
      'https://api.clerk.com',
      'https://*.clerk.com',
      'wss://*.clerk.com'
    ],
    'frame-src': [
      "'self'",
      'https://clerk.com',
      'https://*.clerk.com'
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': []
  };

  // Mode-specific configurations
  switch (mode) {
    case 'strict':
      // Most restrictive - no inline scripts/styles, no eval
      break;
      
    case 'moderate':
      if (allowInlineScripts) {
        directives['script-src'].push("'unsafe-inline'");
      }
      if (allowEval) {
        directives['script-src'].push("'unsafe-eval'");
      }
      break;
      
    case 'permissive':
      directives['script-src'].push("'unsafe-inline'", "'unsafe-eval'");
      directives['style-src'].push("'unsafe-inline'");
      break;
  }

  // Add report URI if provided
  if (reportUri) {
    directives['report-uri'] = [reportUri];
    directives['report-to'] = ['csp-endpoint'];
  }

  // Build CSP string
  const cspParts: string[] = [];
  
  for (const [directive, sources] of Object.entries(directives)) {
    if (sources.length > 0) {
      cspParts.push(`${directive} ${sources.join(' ')}`);
    }
  }

  return cspParts.join('; ');
}

/**
 * Apply CSP headers to response
 */
export function applyCSPHeaders(
  response: NextResponse, 
  config: CSPConfig = { mode: 'strict' }
): NextResponse {
  const csp = generateCSP(config);
  
  response.headers.set('Content-Security-Policy', csp);
  
  // Add CSP report-only header for testing
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('Content-Security-Policy-Report-Only', csp);
  }
  
  return response;
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  const csp = generateCSP({ 
    mode: 'strict',
    trustedDomains: [
      'https://vercel.com',
      'https://*.vercel.com'
    ]
  });
  response.headers.set('Content-Security-Policy', csp);
  
  // Other security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy (formerly Feature Policy)
  response.headers.set('Permissions-Policy', 
    'geolocation=(), ' +
    'microphone=(), ' +
    'camera=(), ' +
    'payment=(), ' +
    'usb=(), ' +
    'magnetometer=(), ' +
    'gyroscope=(), ' +
    'accelerometer=(), ' +
    'ambient-light-sensor=(), ' +
    'autoplay=(), ' +
    'battery=(), ' +
    'display-capture=(), ' +
    'fullscreen=(self), ' +
    'gamepad=(), ' +
    'midi=(), ' +
    'notifications=(), ' +
    'persistent-storage=(), ' +
    'picture-in-picture=(), ' +
    'publickey-credentials-get=(), ' +
    'screen-wake-lock=(), ' +
    'sync-xhr=(), ' +
    'web-share=(), ' +
    'xr-spatial-tracking=()'
  );
  
  // Strict Transport Security
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Cross-Origin policies
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  return response;
}

/**
 * CSP violation handler
 */
export function handleCSPViolation(request: NextRequest): NextResponse {
  try {
    const violation = request.body;
    console.error('CSP Violation:', violation);
    
    // Log violation for monitoring
    // In production, send to security monitoring service
    
    return NextResponse.json({ status: 'received' });
  } catch (error) {
    console.error('Error handling CSP violation:', error);
    return NextResponse.json({ error: 'Failed to process violation' }, { status: 500 });
  }
}

/**
 * Security headers for API routes
 */
export function addAPISecurityHeaders(response: NextResponse): NextResponse {
  // API-specific security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS headers
  response.headers.set('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com' 
    : 'http://localhost:3000'
  );
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

/**
 * Security headers for static assets
 */
export function addStaticAssetSecurityHeaders(response: NextResponse): NextResponse {
  // Cache control for security
  response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  return response;
}

/**
 * Security configuration for different environments
 */
export const securityConfigs = {
  development: {
    mode: 'moderate' as const,
    allowInlineScripts: true,
    allowInlineStyles: true,
    allowEval: true,
    trustedDomains: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://clerk.com',
      'https://*.clerk.com'
    ]
  },
  
  staging: {
    mode: 'strict' as const,
    allowInlineScripts: false,
    allowInlineStyles: true,
    allowEval: false,
    trustedDomains: [
      'https://staging.yourdomain.com',
      'https://clerk.com',
      'https://*.clerk.com'
    ]
  },
  
  production: {
    mode: 'strict' as const,
    allowInlineScripts: false,
    allowInlineStyles: false,
    allowEval: false,
    trustedDomains: [
      'https://yourdomain.com',
      'https://clerk.com',
      'https://*.clerk.com'
    ],
    reportUri: '/api/csp-report'
  }
};

/**
 * Get security config for current environment
 */
export function getSecurityConfig(): CSPConfig {
  const env = process.env.NODE_ENV || 'development';
  return securityConfigs[env as keyof typeof securityConfigs] || securityConfigs.development;
}
