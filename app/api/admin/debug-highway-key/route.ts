import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

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
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

