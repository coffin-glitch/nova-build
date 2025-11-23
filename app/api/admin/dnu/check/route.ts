import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DNU Check API
 * Check if MC or DOT numbers are on the active DNU list
 */

export async function POST(request: NextRequest) {
  try {
    // Check rate limit for public/authenticated operation
    const rateLimit = await checkApiRateLimit(request, {
      routeType: 'public'
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
    const { mc_numbers, dot_numbers } = body;

    // Input validation
    const validation = validateInput(
      { mc_numbers, dot_numbers },
      {
        mc_numbers: { type: 'array', maxLength: 100, required: false },
        dot_numbers: { type: 'array', maxLength: 100, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_dnu_check_input', undefined, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if ((!mc_numbers || !Array.isArray(mc_numbers)) && (!dot_numbers || !Array.isArray(dot_numbers))) {
      const response = NextResponse.json(
        { ok: false, error: "mc_numbers or dot_numbers array required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Clean and prepare MC and DOT numbers
    const cleanMC: string[] = [];
    const cleanDOT: string[] = [];
    
    if (mc_numbers && Array.isArray(mc_numbers) && mc_numbers.length > 0) {
      mc_numbers.forEach(mc => {
        const cleaned = String(mc).replace(/\D/g, '');
        if (cleaned.length > 0) {
          cleanMC.push(cleaned);
        }
      });
    }

    if (dot_numbers && Array.isArray(dot_numbers) && dot_numbers.length > 0) {
      dot_numbers.forEach(dot => {
        const cleaned = String(dot).replace(/\D/g, '');
        if (cleaned.length > 0) {
          cleanDOT.push(cleaned);
        }
      });
    }

    if (cleanMC.length === 0 && cleanDOT.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          is_dnu: false,
          matching_entries: []
        }
      });
    }

    // Build query to check for active DNU entries
    let query;
    if (cleanMC.length > 0 && cleanDOT.length > 0) {
      query = sql`
        SELECT DISTINCT mc_number, dot_number
        FROM dnu_tracking
        WHERE status = 'active'
        AND (
          mc_number = ANY(${cleanMC})
          OR dot_number = ANY(${cleanDOT})
        )
      `;
    } else if (cleanMC.length > 0) {
      query = sql`
        SELECT DISTINCT mc_number, dot_number
        FROM dnu_tracking
        WHERE status = 'active'
        AND mc_number = ANY(${cleanMC})
      `;
    } else {
      query = sql`
        SELECT DISTINCT mc_number, dot_number
        FROM dnu_tracking
        WHERE status = 'active'
        AND dot_number = ANY(${cleanDOT})
      `;
    }

    const result = await query;

    logSecurityEvent('dnu_check_performed', undefined, { 
      mcCount: cleanMC.length,
      dotCount: cleanDOT.length,
      isDnu: result.length > 0
    });

    const response = NextResponse.json({
      ok: true,
      data: {
        is_dnu: result.length > 0,
        matching_entries: result
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error checking DNU status:", error);
    
    logSecurityEvent('dnu_check_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Failed to check DNU status",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

