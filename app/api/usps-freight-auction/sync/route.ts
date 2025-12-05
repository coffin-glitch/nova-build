/**
 * USPS Freight Auction Sync API Route
 * Fetches all pages from USPS endpoint and stores in telegram_bids table
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllPagesHtml } from '@/lib/uspsFreightAuctionClient';
import { parseLoadsFromHtml } from '@/lib/uspsFreightAuctionParser';
import { upsertLoads } from '@/lib/uspsFreightAuctionDb';
import { requireApiAdmin } from '@/lib/auth-api-helper';
import { addSecurityHeaders, logSecurityEvent } from '@/lib/api-security';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request (admin-only or service key)
    // Allow service key for cron jobs, or admin auth for manual triggers
    const serviceKey = request.headers.get('x-service-key');
    const isValidServiceKey = serviceKey === process.env.USPS_FA_SERVICE_KEY;

    if (!isValidServiceKey) {
      // Fall back to admin auth
      try {
        await requireApiAdmin(request);
      } catch (authError) {
        return NextResponse.json(
          { error: 'Unauthorized. Admin access or valid service key required.' },
          { status: 401 }
        );
      }
    }

    const startTime = Date.now();
    console.log('[USPS Sync] Starting sync...');

    // Fetch all pages
    const allPagesHtml = await fetchAllPagesHtml();

    if (allPagesHtml.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No pages fetched from USPS endpoint',
          totalPages: 0,
          totalLoads: 0,
        },
        { status: 500 }
      );
    }

    // Parse all loads from all pages
    const allLoads: Array<ReturnType<typeof parseLoadsFromHtml>[0]> = [];
    for (const html of allPagesHtml) {
      const loads = parseLoadsFromHtml(html);
      allLoads.push(...loads);
    }

    console.log(`[USPS Sync] Parsed ${allLoads.length} total loads from ${allPagesHtml.length} pages`);

    if (allLoads.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No loads found in HTML',
          totalPages: allPagesHtml.length,
          totalLoads: 0,
        },
        { status: 500 }
      );
    }

    // Upsert loads into database
    const upsertResult = await upsertLoads(allLoads);

    const duration = Date.now() - startTime;

    // Log security event
    logSecurityEvent('usps_freight_auction_sync', undefined, {
      totalPages: allPagesHtml.length,
      totalLoads: allLoads.length,
      inserted: upsertResult.inserted,
      updated: upsertResult.updated,
      errors: upsertResult.errors.length,
      durationMs: duration,
    });

    console.log(`[USPS Sync] Sync complete in ${duration}ms`);

    return NextResponse.json(
      {
        success: true,
        totalPages: allPagesHtml.length,
        totalLoads: allLoads.length,
        newLoads: upsertResult.inserted,
        updatedLoads: upsertResult.updated,
        errors: upsertResult.errors,
        durationMs: duration,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[USPS Sync] Error during sync:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    logSecurityEvent('usps_freight_auction_sync_error', undefined, {
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing (with admin auth)
export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    // Trigger sync by calling POST handler logic
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: null,
    });

    return POST(postRequest);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 401 }
    );
  }
}

