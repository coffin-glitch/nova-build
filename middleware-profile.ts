import sql from '@/lib/db';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, and auth pages
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    pathname === '/profile' ||
    pathname.startsWith('/admin/')
  ) {
    return NextResponse.next();
  }

  try {
    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // If Supabase not configured, skip middleware
      return NextResponse.next();
    }

    // Use service role key for admin access or anon key with cookie handling
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseAnonKey) {
      return NextResponse.next();
    }

    // Create Supabase client with proper cookie handling for Edge runtime (same as main middleware)
    const { createServerClient } = await import('@supabase/ssr');
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // Cookies will be set via response headers
          request.cookies.set(name, value);
        },
        remove(name: string, options: any) {
          // Cookies will be removed via response headers
          request.cookies.delete(name);
        },
      },
    });
    
    // Get user from session
    const { data: { user }, error } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Skip middleware for non-authenticated users
    if (!userId) {
      return NextResponse.next();
    }

    // Check if user is a carrier and needs profile completion
    const profileResult = await sql`
      SELECT 
        profile_status,
        is_first_login,
        profile_completed_at,
        submitted_at,
        reviewed_at,
        decline_reason,
        edits_enabled
      FROM carrier_profiles 
      WHERE supabase_user_id = ${userId}
    `;

    const profile = profileResult[0];

    // If no profile exists, redirect to profile creation
    if (!profile) {
      if (pathname !== '/carrier/profile') {
        return NextResponse.redirect(new URL('/carrier/profile?setup=true', request.url));
      }
      return NextResponse.next();
    }

    // If it's first login and profile not completed, redirect to profile
    if (profile.is_first_login && !profile.profile_completed_at) {
      if (pathname !== '/carrier/profile') {
        return NextResponse.redirect(new URL('/carrier/profile?setup=true', request.url));
      }
      return NextResponse.next();
    }

    // If profile is pending approval, show pending status
    if (profile.profile_status === 'pending') {
      if (pathname !== '/carrier/profile') {
        return NextResponse.redirect(new URL('/carrier/profile?status=pending', request.url));
      }
      return NextResponse.next();
    }

    // If profile is declined, show decline message
    if (profile.profile_status === 'declined') {
      if (pathname !== '/carrier/profile') {
        return NextResponse.redirect(new URL('/carrier/profile?status=declined', request.url));
      }
      return NextResponse.next();
    }

    // If profile is approved, allow access to all carrier pages
    if (profile.profile_status === 'approved') {
      return NextResponse.next();
    }

    // Default: allow access
    return NextResponse.next();

  } catch (error) {
    console.error('Profile middleware error:', error);
    // On error, allow access to prevent blocking users
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
