/**
 * Authentication Configuration and Feature Toggle
 * 
 * Centralized configuration for switching between Clerk and Supabase auth.
 * Provides monitoring, rollback capability, and feature flag management.
 */

/**
 * Get the current auth provider from environment or default to Clerk
 */
export function getAuthProvider(): 'clerk' | 'supabase' {
  const provider = process.env.AUTH_PROVIDER?.toLowerCase() || 'clerk';
  const useSupabase = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';
  
  // Prioritize NEXT_PUBLIC_USE_SUPABASE_AUTH for client-side, AUTH_PROVIDER for server
  if (typeof window !== 'undefined') {
    return useSupabase ? 'supabase' : 'clerk';
  }
  
  return provider === 'supabase' ? 'supabase' : 'clerk';
}

/**
 * Check if Supabase auth is enabled
 */
export function isSupabaseAuthEnabled(): boolean {
  return getAuthProvider() === 'supabase';
}

/**
 * Check if Clerk auth is enabled
 */
export function isClerkAuthEnabled(): boolean {
  return getAuthProvider() === 'clerk';
}

/**
 * Auth configuration for feature flags
 */
export interface AuthConfig {
  provider: 'clerk' | 'supabase';
  allowDualAuth: boolean;
  enableMonitoring: boolean;
  enableRollback: boolean;
}

/**
 * Get current auth configuration
 */
export function getAuthConfig(): AuthConfig {
  const provider = getAuthProvider();
  const allowDualAuth = process.env.ALLOW_DUAL_AUTH === 'true';
  const enableMonitoring = process.env.ENABLE_AUTH_MONITORING !== 'false';
  const enableRollback = process.env.ENABLE_AUTH_ROLLBACK !== 'false';
  
  return {
    provider,
    allowDualAuth,
    enableMonitoring,
    enableRollback,
  };
}

/**
 * Validate auth configuration
 */
export function validateAuthConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = getAuthConfig();
  
  // Check required environment variables
  if (config.provider === 'supabase') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required for Supabase auth');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for Supabase auth');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY is recommended for Supabase auth');
    }
  }
  
  if (config.provider === 'clerk') {
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for Clerk auth');
    }
    if (!process.env.CLERK_SECRET_KEY) {
      errors.push('CLERK_SECRET_KEY is required for Clerk auth');
    }
  }
  
  // Dual auth validation
  if (config.allowDualAuth && config.provider === 'supabase') {
    warnings.push('Dual auth mode may cause unexpected behavior. Use with caution.');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log auth configuration for monitoring
 */
export function logAuthConfig(): void {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_AUTH_MONITORING === 'false') {
    return; // Skip logging if monitoring disabled
  }
  
  const config = getAuthConfig();
  const validation = validateAuthConfig();
  
  console.log('[Auth Config] Current configuration:', {
    provider: config.provider,
    allowDualAuth: config.allowDualAuth,
    enableMonitoring: config.enableMonitoring,
    enableRollback: config.enableRollback,
    valid: validation.valid,
    errors: validation.errors.length,
    warnings: validation.warnings.length,
  });
  
  if (validation.errors.length > 0) {
    console.error('[Auth Config] Errors:', validation.errors);
  }
  
  if (validation.warnings.length > 0) {
    console.warn('[Auth Config] Warnings:', validation.warnings);
  }
}



