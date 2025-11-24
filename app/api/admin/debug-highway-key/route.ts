import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const apiKey = process.env.HIGHWAY_API_KEY;
    
    return NextResponse.json({
      ok: true,
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey ? apiKey.substring(0, 50) + "..." : "N/A",
      keySuffix: apiKey ? "..." + apiKey.substring(apiKey.length - 50) : "N/A",
      firstChar: apiKey ? apiKey[0] : "N/A",
      lastChar: apiKey ? apiKey[apiKey.length - 1] : "N/A",
      // Decode JWT to check expiration
      jwtInfo: apiKey ? (() => {
        try {
          const parts = apiKey.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const exp = payload.exp;
            const expDate = new Date(exp * 1000);
            const now = new Date();
            return {
              expiresAt: expDate.toISOString(),
              isExpired: now > expDate,
              userId: payload.UId,
              isApiKey: payload.is_api_key,
              issuer: payload.iss,
              isActive: payload.is_active ?? true, // Check if key is active
              externalProvider: payload.external_provider,
              connectIntegrationId: payload.connect_integration_id,
            };
          }
        } catch (e) {
          return { error: "Failed to decode JWT" };
        }
      })() : null
    });
    
    logSecurityEvent('highway_key_debug_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey ? apiKey.substring(0, 50) + "..." : "N/A",
      keySuffix: apiKey ? "..." + apiKey.substring(apiKey.length - 50) : "N/A",
      firstChar: apiKey ? apiKey[0] : "N/A",
      lastChar: apiKey ? apiKey[apiKey.length - 1] : "N/A",
      // Decode JWT to check expiration
      jwtInfo: apiKey ? (() => {
        try {
          const parts = apiKey.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const exp = payload.exp;
            const expDate = new Date(exp * 1000);
            const now = new Date();
            return {
              expiresAt: expDate.toISOString(),
              isExpired: now > expDate,
              userId: payload.UId,
              isApiKey: payload.is_api_key,
              issuer: payload.iss,
              isActive: payload.is_active ?? true, // Check if key is active
              externalProvider: payload.external_provider,
              connectIntegrationId: payload.connect_integration_id,
            };
          }
        } catch (e) {
          return { error: "Failed to decode JWT" };
        }
      })() : null
    });
    
    return addSecurityHeaders(response, request);
    
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_key_debug_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false, 
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : "Failed to debug Highway API key"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

