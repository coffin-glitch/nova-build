### Phase 0: Supabase Secrets and Client Setup

Required environment variables:

- NEXT_PUBLIC_SUPABASE_URL: https://<project-ref>.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Public anon key (Dashboard → Settings → API)
- SUPABASE_SERVICE_ROLE_KEY: Service role key (server only, never to browser)
- DATABASE_URL: Use pgBouncer pooler URL (transaction mode)
- Optional pool tuning: PG_POOL_MAX, PG_IDLE_TIMEOUT, PG_CONNECT_TIMEOUT, PG_MAX_LIFETIME

Where to store secrets:

- Production host (e.g., Vercel): Project → Settings → Environment Variables
- Supabase: Project Settings → Configuration → Secrets (for Functions/Edge)
- CI (GitHub Actions): Repository → Settings → Secrets and variables → Actions
- Local dev (not committed): .env.local

Client helpers:

- lib/supabase.ts provides:
  - getSupabaseBrowser(): browser client (anon key)
  - getSupabaseServer(headers, cookies): server client (anon key)
  - getSupabaseService(): service role client (server‑only)

Next steps:

1) Add env vars in your deploy provider and locally in .env.local.
2) Restart dev server to load env.
3) Use getSupabaseBrowser()/getSupabaseServer() in new code paths; we will bridge Clerk → Supabase in Phase 2.



