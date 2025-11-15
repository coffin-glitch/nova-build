import { createBrowserClient, createServerClient } from '@supabase/ssr';

// Browser/client-side Supabase (uses public anon key)
let browserSupabase: ReturnType<typeof createBrowserClient> | null = null;
export function getSupabaseBrowser() {
	if (!browserSupabase) {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
		const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
		if (!url || !anon) {
			throw new Error('Supabase client missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
		}
		browserSupabase = createBrowserClient(url, anon);
	}
	return browserSupabase;
}

// Helper to create cookie adapter from Next.js cookies
// For Server Components: read-only (no set/remove) to avoid "Cookies can only be modified in Server Action or Route Handler" error
// For Route Handlers/Server Actions: full read/write access
export function createCookieAdapter(
	cookieStore: Awaited<ReturnType<typeof import('next/headers').cookies>>,
	readOnly: boolean = false
) {
	return {
		get(name: string) {
			const cookie = cookieStore.get(name);
			return cookie ? { value: cookie.value } : undefined;
		},
		set(name: string, value: string, options?: { path?: string; maxAge?: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: 'strict' | 'lax' | 'none' }) {
			if (readOnly) {
				// In Server Components, we can't modify cookies - Supabase will handle this client-side
				// This is safe because Supabase only tries to set cookies during session refresh,
				// which happens in Route Handlers (like /auth/callback) where readOnly=false
				return;
			}
			// Filter out boolean sameSite values (Next.js accepts boolean, but we only want string values)
			const filteredOptions = options ? {
				...options,
				sameSite: typeof options.sameSite === 'string' ? options.sameSite : undefined
			} : undefined;
			cookieStore.set(name, value, filteredOptions);
		},
		remove(name: string, _options?: { path?: string; domain?: string }) {
			if (readOnly) {
				// In Server Components, we can't modify cookies
				return;
			}
			cookieStore.delete(name);
		},
	};
}

// Server-side Supabase (reads cookies via headers)
// The cookies adapter must have get(), set(), and remove() methods compatible with @supabase/ssr
export function getSupabaseServer(
	headers: Headers, 
	cookies: {
		get: (name: string) => { value?: string } | undefined;
		set: (name: string, value: string, options?: { path?: string; maxAge?: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: 'strict' | 'lax' | 'none' }) => void;
		remove: (name: string, options?: { path?: string; domain?: string }) => void;
	}
) {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
	if (!url || !anon) {
		throw new Error('Supabase server client missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
	}
	return createServerClient(url, anon, {
		cookies: {
			get(name: string) {
				const cookie = cookies.get(name);
				return cookie?.value ?? null;
			},
			set(name: string, value: string, options?: { path?: string; maxAge?: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: boolean | 'strict' | 'lax' | 'none' }) {
				// Filter out boolean sameSite values (Supabase's deprecated API accepts boolean, but Next.js cookies need string or undefined)
				const filteredOptions = options ? {
					...options,
					sameSite: typeof options.sameSite === 'string' ? options.sameSite : undefined
				} : undefined;
				cookies.set(name, value, filteredOptions);
			},
			remove(name: string, options?: { path?: string; domain?: string }) {
				cookies.remove(name, options);
			},
		},
	});
}

// Service role client (server-only, do NOT expose to browser)
import { createClient as createServiceClient, SupabaseClient } from '@supabase/supabase-js';
let serviceClient: SupabaseClient | null = null;
export function getSupabaseService(): SupabaseClient {
	if (!serviceClient) {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
		if (!url || !key) {
			throw new Error('Service role client missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
		}
		serviceClient = createServiceClient(url, key, {
			auth: { persistSession: false },
		});
	}
	return serviceClient;
}

