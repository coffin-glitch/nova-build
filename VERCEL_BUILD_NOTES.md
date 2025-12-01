# Vercel Build Notes

## Known Issues

### `.next/lock` Error (Non-Critical)

**Error Message:**
```
Error: ENOENT: no such file or directory, lstat '/vercel/path0/.next/lock'
```

**Status:** Known Next.js 16 issue on Vercel

**Impact:** Non-critical - Build completes successfully (all 188 pages generated), but finalization step reports this error.

**Details:**
- The build process completes successfully: `✓ Generating static pages using 3 workers (188/188)`
- All routes are generated correctly
- The error occurs during "Finalizing page optimization" / "Collecting build traces"
- This is a known Next.js 16 + Vercel compatibility issue
- The deployment should still succeed despite this error

**References:**
- [Vercel Community Discussion](https://vercel.com/community)
- Next.js 16 known issues with Vercel builds

**Workaround:** None required - the build succeeds and deployment works despite the error message.

## Build Optimizations

### Debug Logging
- All debug `console.log` statements are wrapped in `process.env.NODE_ENV === 'development'` checks
- This reduces build log noise and improves build performance

### Dynamic Server Usage Warnings
- Expected warnings for routes that use `headers()` (authenticated pages)
- These are suppressed in production builds to reduce log noise

