# Supabase Redirect URLs Configuration

## Recommended Redirect URLs

Keep these URLs in your Supabase Dashboard → Authentication → URL Configuration:

### Development
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/**`

### Production
- `https://novafreight.io`
- `https://novafreight.io/auth/callback`
- `https://novafreight.io/**`

### Preview Deployments (Vercel)
- `https://nova-*-build-duke-isaacs-projects.vercel.app/**` (covers all preview deployments)

## URLs to Remove

You can safely remove these (they're redundant):

### Specific Vercel URLs (redundant - wildcard covers them)
- ❌ `https://nova-build-duke-isaacs-projects.vercel.app/`
- ❌ `https://nova-build-duke-isaacs-projects.vercel.app/**`
- ❌ `https://nova-build-coffin-glitch-duke-isaacs-projects.vercel.app/`
- ❌ `https://nova-build-coffin-glitch-duke-isaacs-projects.vercel.app/**`

### Duplicate Wildcards (keep only one)
- ❌ `https://nova-*-build-coffin-glitch-duke-isaacs-projects.vercel.app`
- ❌ `https://nova-*-build-coffin-glitch-duke-isaacs-projects.vercel.app/**`

(Keep only: `https://nova-*-build-duke-isaacs-projects.vercel.app/**`)

## Why Keep Vercel Wildcard?

The wildcard pattern `https://nova-*-build-duke-isaacs-projects.vercel.app/**` automatically covers:
- All preview deployments (when you push to branches)
- All deployment URLs with different prefixes
- Testing before merging to main

This is useful for testing OAuth flows on preview deployments without manually adding each URL.

## Summary

**Final list (7 URLs):**
1. `http://localhost:3000/auth/callback`
2. `http://localhost:3000/**`
3. `https://novafreight.io`
4. `https://novafreight.io/auth/callback`
5. `https://novafreight.io/**`
6. `https://nova-*-build-duke-isaacs-projects.vercel.app/**`

**Remove the rest** - they're redundant and clutter the configuration.

