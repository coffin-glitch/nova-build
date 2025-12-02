import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Get the base URL for redirects
 * Uses NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL if set, otherwise falls back to request origin
 */
function getBaseUrl(requestUrl: URL): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl) {
    // Remove trailing slash if present
    return envUrl.replace(/\/$/, '');
  }
  // Fallback to request origin (for local development)
  return requestUrl.origin;
}

/**
 * Supabase Auth Callback Handler
 * 
 * Handles OAuth callbacks, email confirmations, password resets, and magic links
 * from Supabase Auth. This replaces Clerk's automatic email handling.
 * 
 * Routes:
 * - /auth/callback?code=xxx - OAuth/email confirmation
 * - /auth/callback?type=recovery&token=xxx - Password reset
 * - /auth/callback?type=magiclink&token=xxx - Magic link
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const baseUrl = getBaseUrl(requestUrl);
  const code = requestUrl.searchParams.get('code');
  const token = requestUrl.searchParams.get('token');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // 🐛 DEBUG: Log all callback parameters
  console.log('🐛 [AUTH CALLBACK DEBUG] ===========================================');
  console.log('🐛 Full URL:', requestUrl.toString());
  console.log('🐛 Code:', code ? '✅ Present' : '❌ Missing');
  console.log('🐛 Token:', token ? '✅ Present' : '❌ Missing');
  console.log('🐛 Type:', type || 'None');
  console.log('🐛 Next:', next);
  console.log('🐛 Error:', error || 'None');
  console.log('🐛 Error Description:', errorDescription || 'None');
  console.log('🐛 All search params:', Object.fromEntries(requestUrl.searchParams.entries()));

  // Handle errors
  if (error) {
    console.error('[Auth Callback] Error:', error, errorDescription);
    const errorUrl = new URL('/sign-in?error=auth_failed', baseUrl);
    
    // Ensure error_description is always a string
    const safeErrorDescription = errorDescription || error || 'Authentication failed';
    const finalErrorDescription = typeof safeErrorDescription === 'string' 
      ? safeErrorDescription 
      : String(safeErrorDescription);
    
    errorUrl.searchParams.set('error_description', finalErrorDescription);
    return NextResponse.redirect(errorUrl);
  }

  try {
    const headersList = await headers();
    const cookieStore = await cookies();
    
    // Debug: Log all cookies to see if PKCE code verifier is present
    console.log('🐛 [AUTH CALLBACK DEBUG] Cookies available:', Array.from(cookieStore.getAll()).map(c => c.name));
    
    // Convert Next.js cookies to format expected by Supabase SSR
    // The @supabase/ssr createServerClient expects a specific cookie interface
    // We'll create the response AFTER we have the session to redirect correctly
    let finalRedirectUrl = next;
    
    // Cookie adapter for Supabase SSR - matches the official Next.js + Supabase guide exactly
    // See: https://supabase.com/docs/guides/auth/server-side/nextjs
    const cookieAdapter = {
      getAll() {
        // Return all cookies directly, filtering out Clerk cookies
        const allCookies = cookieStore.getAll();
        return allCookies
          .filter(cookie => {
            const name = cookie.name;
            // Filter out Clerk cookies - we're using Supabase only
            if (name.startsWith('__clerk_') || name.startsWith('clerk_')) {
              return false;
            }
            return true;
          })
          .map(cookie => ({
            name: cookie.name,
            value: cookie.value
          }));
      },
      
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        try {
          // In route handlers, we can set cookies directly
          // Queue them for setting on the response after we create it
          if (!(cookieAdapter as any)._cookieQueue) {
            (cookieAdapter as any)._cookieQueue = [];
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            (cookieAdapter as any)._cookieQueue.push({ name, value, options });
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    };
    
    // Use createServerClient from @supabase/ssr to properly handle PKCE flow
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Auth Callback] Supabase not configured');
      return NextResponse.redirect(new URL('/sign-in?error=configuration_error', baseUrl));
    }
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: cookieAdapter,
    });

    // Handle OAuth/email confirmation code
    if (code) {
      console.log('🐛 [AUTH CALLBACK DEBUG] Exchanging code for session...');
      console.log('🐛 Code length:', code.length);
      console.log('🐛 Code preview:', code.substring(0, 20) + '...');
      console.log('🐛 Cookie adapter type:', typeof cookieAdapter);
      console.log('🐛 Cookie adapter getAll type:', typeof cookieAdapter.getAll);
      
      let codeError: any = null;
      let data: any = null;
      
      try {
        const result = await supabase.auth.exchangeCodeForSession(code);
        codeError = result.error;
        data = result.data;
      } catch (exchangeErr: any) {
        console.error('❌ [AUTH CALLBACK DEBUG] Exception during exchangeCodeForSession:', exchangeErr);
        console.error('❌ Exception type:', typeof exchangeErr);
        console.error('❌ Exception name:', exchangeErr?.name);
        console.error('❌ Exception message:', exchangeErr?.message);
        console.error('❌ Exception stack:', exchangeErr?.stack?.substring(0, 500));
        
        // Convert the exception to an error object
        codeError = exchangeErr instanceof Error ? exchangeErr : new Error(String(exchangeErr || 'Unknown error'));
      }
      
      console.log('🐛 [AUTH CALLBACK DEBUG] Exchange result:');
      console.log('🐛 - Error:', codeError ? `❌ ${codeError.message}` : '✅ None');
      console.log('🐛 - Has data:', !!data);
      console.log('🐛 - Has session:', !!data?.session);
      console.log('🐛 - Has user:', !!data?.session?.user);
      console.log('🐛 - User email:', data?.session?.user?.email || 'None');
      console.log('🐛 - Session expires:', data?.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : 'None');
      console.log('🐛 - Access token present:', !!data?.session?.access_token);
      console.log('🐛 - Refresh token present:', !!data?.session?.refresh_token);
      
      if (codeError) {
        console.error('❌ [Auth Callback] Code exchange error:', codeError);
        console.error('❌ Code error details:', {
          name: codeError?.name,
          message: codeError?.message,
          status: codeError?.status,
          statusCode: codeError?.statusCode,
          type: typeof codeError
        });
        
        // Check for specific error types
        let errorMessage = 'Code exchange failed';
        if (codeError?.message) {
          errorMessage = typeof codeError.message === 'string' 
            ? codeError.message 
            : String(codeError.message);
        }
        
        // Check for common PKCE errors
        if (errorMessage.includes('code_verifier') || errorMessage.includes('PKCE')) {
          console.error('❌ PKCE error detected - code verifier may be missing or invalid');
          errorMessage = 'Authentication code verification failed. Please try signing in again.';
        } else if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
          errorMessage = 'The authentication code has expired or is invalid. Please try signing in again.';
        }
        
        const errorUrl = new URL('/sign-in?error=code_exchange_failed', baseUrl);
        
        // Sanitize error message for URL
        const safeErrorDesc = errorMessage
          .replace(/[^\w\s\-.,!?]/g, '')
          .substring(0, 200);
        
        errorUrl.searchParams.set('error_description', safeErrorDesc);
        return NextResponse.redirect(errorUrl);
      }

      if (data?.session?.user) {
        console.log('✅ [Auth Callback] Success! User authenticated:', data.session.user.email);
        console.log('🐛 [AUTH CALLBACK DEBUG] Email confirmed:', !!data.session.user.email_confirmed_at);
        
        // Automatically assign "carrier" role to new users if they don't have one
        try {
          const sql = (await import("@/lib/db")).default;
          const userId = data.session.user.id;
          const userEmail = data.session.user.email || `user_${userId.substring(0, 8)}@placeholder.local`;
          
          // Check if user already has a role in cache
          const existingRole = await sql`
            SELECT role FROM user_roles_cache 
            WHERE supabase_user_id = ${userId} 
            LIMIT 1
          `;
          
          // If no role exists, create one with "carrier" as default
          if (!existingRole || existingRole.length === 0) {
            await sql`
              INSERT INTO user_roles_cache (
                supabase_user_id,
                role,
                email,
                last_synced,
                created_at
              ) VALUES (
                ${userId},
                'carrier',
                ${userEmail.toLowerCase()},
                NOW(),
                NOW()
              )
              ON CONFLICT (supabase_user_id) DO NOTHING
            `;
            console.log('✅ [Auth Callback] Auto-assigned "carrier" role to new user:', data.session.user.email);
          }
        } catch (roleError) {
          console.warn('[Auth Callback] Could not auto-assign carrier role:', roleError);
          // Continue anyway - user can still sign in
        }
        
        // OAuth providers (like Google) automatically confirm emails
        // But check anyway - if not confirmed, redirect to verification page
        if (!data.session.user.email_confirmed_at) {
          console.log('⚠️ [Auth Callback] Email not confirmed, redirecting to verification page');
          finalRedirectUrl = `/verify-email?email=${encodeURIComponent(data.session.user.email || '')}`;
        } else {
          // Email is confirmed - check user role and redirect appropriately
          // If next is not set (default '/'), check user role and redirect to appropriate page
          if (next === '/') {
            try {
              // Query user role from database
              const { createClient } = await import('@supabase/supabase-js');
              const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
              if (serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
                const adminClient = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL,
                  serviceRoleKey
                );
                
                // Query role directly from database (bypass any caching)
                const sql = (await import("@/lib/db")).default;
                const roleResult = await sql`
                  SELECT role FROM user_roles_cache 
                  WHERE supabase_user_id = ${data.session.user.id} 
                  LIMIT 1
                `;
                
                const userRole = roleResult[0]?.role;
                
                // CRITICAL: Always redirect admins to /admin, never to carrier routes
                if (userRole === 'admin') {
                  finalRedirectUrl = '/admin';
                  console.log('✅ [Auth Callback] Admin user detected, redirecting to /admin (bypassing carrier routes)');
                } else if (userRole === 'carrier') {
                  // For carriers, check if they have a profile - if not, redirect to profile setup
                  const profileCheck = await sql`
                    SELECT id FROM carrier_profiles 
                    WHERE supabase_user_id = ${data.session.user.id} 
                    LIMIT 1
                  `;
                  
                  if (!profileCheck || profileCheck.length === 0) {
                    // No profile exists - redirect to profile setup for fresh start
                    finalRedirectUrl = '/carrier/profile?setup=true';
                    console.log('✅ [Auth Callback] Carrier user with no profile, redirecting to profile setup');
                  } else {
                    // Profile exists - redirect to home (middleware will handle profile status checks)
                    finalRedirectUrl = '/';
                    console.log('✅ [Auth Callback] Carrier user with profile, redirecting to home');
                  }
                } else {
                  // No role or unknown role - redirect to home
                  finalRedirectUrl = '/';
                  console.log(`✅ [Auth Callback] User role: ${userRole || 'none'}, redirecting to home`);
                }
              } else {
                // Fallback to home if we can't check role
                finalRedirectUrl = '/';
              }
            } catch (roleError) {
              console.warn('[Auth Callback] Could not check user role, using default redirect:', roleError);
              finalRedirectUrl = '/';
            }
          } else {
            // Use the provided next parameter
            finalRedirectUrl = next;
          }
        }
        
        // Create response and set all queued cookies
        const response = NextResponse.redirect(new URL(finalRedirectUrl, baseUrl));
        
        // CRITICAL: Aggressively delete all Clerk cookies - we're using Supabase only now
        const allCookies = Array.from(cookieStore.getAll());
        const clerkCookies = allCookies.filter(cookie => {
          const name = cookie.name;
          return name.startsWith('__clerk_') || 
                 name.startsWith('clerk_') || 
                 name.includes('clerk') ||
                 name.startsWith('__refresh_') ||
                 name.startsWith('__client_uat') ||
                 name.startsWith('__session_');
        });
        
        clerkCookies.forEach((cookie) => {
          const cookieName = cookie.name;
          console.log(`🧹 [AUTH CALLBACK] Deleting Clerk cookie: ${cookieName}`);
          
          // Delete with multiple methods to ensure removal
          response.cookies.delete(cookieName);
          
          // Also set with expired date to force browser to remove it
          response.cookies.set(cookieName, '', {
            path: '/',
            maxAge: 0,
            expires: new Date(0),
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
          });
        });
        
        // Apply all queued cookies from the adapter (Supabase cookies)
        if ((cookieAdapter as any)._cookieQueue) {
          (cookieAdapter as any)._cookieQueue.forEach((cookie: any) => {
            if (cookie.remove) {
              response.cookies.delete(cookie.name);
            } else {
              response.cookies.set(cookie.name, cookie.value, {
                ...cookie.options,
                path: cookie.options?.path || '/',
                sameSite: cookie.options?.sameSite || 'lax',
                secure: cookie.options?.secure ?? (process.env.NODE_ENV === 'production'),
                httpOnly: cookie.options?.httpOnly ?? true,
                maxAge: cookie.options?.maxAge || 60 * 60 * 24 * 7, // 7 days
              });
            }
          });
        }
        
        console.log('🐛 [AUTH CALLBACK DEBUG] Final redirect to:', finalRedirectUrl);
        console.log('🐛 [AUTH CALLBACK DEBUG] Response cookies set:', Array.from(response.cookies.getAll()).map(c => c.name));
        console.log('🧹 [AUTH CALLBACK] Clerk cookies cleaned up');
        return response;
      }

      // No session - redirect to sign in
      console.log('⚠️ [Auth Callback] No session data after code exchange');
      return NextResponse.redirect(new URL('/sign-in?error=no_session', baseUrl));
    }

    // Handle token-based auth (password reset, magic link)
    if (token && type) {
      let redirectUrl: string;

      switch (type) {
        case 'recovery':
          // Password reset - verify the token and establish session
          // The token_hash needs to be verified to create a session
          const { error: recoveryError, data: recoveryData } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery',
          });

          if (recoveryError) {
            console.error('[Auth Callback] Password recovery verification error:', recoveryError);
            const errorUrl = new URL('/auth/reset-password?error=invalid_token', baseUrl);
            return NextResponse.redirect(errorUrl);
          }

          // After verification, session is established - redirect to reset password page
          redirectUrl = `/auth/reset-password`;
          break;
        
        case 'magiclink':
          // Magic link - verify and sign in
          const { error: verifyError, data } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink',
          });

          if (verifyError) {
            console.error('[Auth Callback] Magic link verification error:', verifyError);
            const errorUrl = new URL('/sign-in?error=magiclink_failed', baseUrl);
            return NextResponse.redirect(errorUrl);
          }

          // Success - redirect to home or next URL
          redirectUrl = next;
          break;

        default:
          console.warn('[Auth Callback] Unknown token type:', type);
          redirectUrl = '/sign-in?error=invalid_token_type';
      }

      return NextResponse.redirect(new URL(redirectUrl, baseUrl));
    }

    // No code or token - redirect to sign in
    return NextResponse.redirect(new URL('/sign-in', baseUrl));

  } catch (error: any) {
    console.error('[Auth Callback] Exception:', error);
    console.error('[Auth Callback] Error type:', typeof error);
    console.error('[Auth Callback] Error message type:', typeof error?.message);
    console.error('[Auth Callback] Error message value:', error?.message);
    console.error('[Auth Callback] Error stack:', error?.stack);
    
    const errorUrl = new URL('/sign-in?error=callback_exception', baseUrl);
    
    // Ensure error_description is always a simple string - catch any errors during conversion
    let errorDescription = 'Authentication callback failed';
    try {
      if (error) {
        if (typeof error === 'string') {
          errorDescription = error;
        } else if (error?.message && typeof error.message === 'string') {
          errorDescription = error.message;
        } else if (error?.name && typeof error.name === 'string') {
          errorDescription = `${error.name}: Authentication failed`;
        } else {
          // Last resort: try to get any useful string representation
          try {
            const errorStr = String(error);
            if (errorStr && errorStr !== '[object Object]') {
              errorDescription = errorStr.substring(0, 200); // Limit length
            }
          } catch {
            // If even String() fails, use default
          }
        }
      }
    } catch (conversionError) {
      console.error('[Auth Callback] Error converting error message:', conversionError);
      errorDescription = 'Authentication callback failed';
    }
    
    // Ensure the description doesn't contain characters that could break URL parsing
    errorDescription = errorDescription.replace(/[^\w\s\-.,!?]/g, '').substring(0, 200);
    
    try {
      errorUrl.searchParams.set('error_description', errorDescription);
    } catch (urlError) {
      console.error('[Auth Callback] Error setting error_description in URL:', urlError);
      // If setting the param fails, just redirect without it
    }
    
    return NextResponse.redirect(errorUrl);
  }
}

