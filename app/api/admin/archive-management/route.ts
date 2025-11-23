import {
  archiveExpiredBids,
  cleanupOldArchiveTables,
  getArchiveStatistics,
  verifyArchiveIntegrity
} from "@/lib/archive-migration";
import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Input validation
    const validation = validateInput(
      { action },
      {
        action: { type: 'string', enum: ['statistics', 'integrity'], required: false }
      }
    );

    if (!validation.valid && action) {
      logSecurityEvent('invalid_archive_management_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    switch (action) {
      case "statistics":
        const stats = await getArchiveStatistics();
        logSecurityEvent('archive_statistics_accessed', userId);
        const statsResponse = NextResponse.json({ ok: true, data: stats });
        return addRateLimitHeaders(addSecurityHeaders(statsResponse), rateLimit);

      case "integrity":
        const integrity = await verifyArchiveIntegrity();
        logSecurityEvent('archive_integrity_checked', userId);
        const integrityResponse = NextResponse.json({ ok: true, data: integrity });
        return addRateLimitHeaders(addSecurityHeaders(integrityResponse), rateLimit);

      default:
        const defaultResponse = NextResponse.json({ error: "Invalid action" }, { status: 400 });
        return addSecurityHeaders(defaultResponse);
    }

  } catch (error: any) {
    console.error("Archive management API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('archive_management_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to process request",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (archive operations are critical)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const body = await request.json();
    const { action } = body;

    // Input validation
    const validation = validateInput(
      { action },
      {
        action: { required: true, type: 'string', enum: ['archive', 'cleanup'] }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_archive_management_post_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    switch (action) {
      case "archive":
        const archiveResult = await archiveExpiredBids();
        logSecurityEvent('archive_bids_triggered', userId, { archived: archiveResult.archived });
        const archiveResponse = NextResponse.json({ 
          ok: true, 
          data: archiveResult,
          message: `Successfully archived ${archiveResult.archived} bids`
        });
        return addRateLimitHeaders(addSecurityHeaders(archiveResponse), rateLimit);

      case "cleanup":
        const cleanupResult = await cleanupOldArchiveTables();
        logSecurityEvent('archive_cleanup_triggered', userId, { cleaned: cleanupResult.cleaned.length });
        const cleanupResponse = NextResponse.json({ 
          ok: true, 
          data: cleanupResult,
          message: `Cleanup completed. Cleaned: ${cleanupResult.cleaned.length} tables`
        });
        return addRateLimitHeaders(addSecurityHeaders(cleanupResponse), rateLimit);

      default:
        const defaultResponse = NextResponse.json({ error: "Invalid action" }, { status: 400 });
        return addSecurityHeaders(defaultResponse);
    }

  } catch (error: any) {
    console.error("Archive management API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('archive_management_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to process request",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
