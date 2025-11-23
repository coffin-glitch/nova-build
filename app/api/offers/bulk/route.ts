import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest } from "next/server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  try {
    // Ensure user is admin
    const auth = await requireApiAdmin(req);
    const userId = auth.userId;

    // Check rate limit for admin write operation (bulk operations are critical)
    const rateLimit = await checkApiRateLimit(req, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const body = await req.json();
    const { offerIds, action, adminNotes } = body;

    // Input validation
    const validation = validateInput(
      { offerIds, action, adminNotes },
      {
        offerIds: { required: true, type: 'array', minLength: 1, maxLength: 100 },
        action: { required: true, type: 'string', enum: ['accept', 'reject'] },
        adminNotes: { type: 'string', maxLength: 2000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bulk_offer_action_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
      const response = NextResponse.json(
        { error: "No offers selected" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      const response = NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate that all offers exist and are pending (Supabase-only)
    const offers = await sql`
      SELECT id, supabase_carrier_user_id, carrier_user_id, load_rr_number, offer_amount, status
      FROM load_offers 
      WHERE id = ANY(${offerIds}) AND status = 'pending'
    `;

    if (offers.length !== offerIds.length) {
      logSecurityEvent('bulk_offer_validation_failed', userId, { 
        requestedCount: offerIds.length,
        foundCount: offers.length
      });
      const response = NextResponse.json(
        { error: "Some offers not found or not pending" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Update all offers
    const updateResult = await sql`
      UPDATE load_offers 
      SET 
        status = ${action === 'accept' ? 'accepted' : 'rejected'},
        admin_notes = ${adminNotes || null},
        updated_at = NOW()
      WHERE id = ANY(${offerIds})
      RETURNING id, supabase_carrier_user_id, carrier_user_id, load_rr_number
    `;

    // Create notifications for each carrier (Supabase-only)
    for (const offer of updateResult) {
      const carrierSupabaseUserId = offer.supabase_carrier_user_id || offer.carrier_user_id;
      
      await sql`
        INSERT INTO carrier_notifications (
          supabase_user_id,
          carrier_user_id,
          type,
          title,
          message,
          is_read,
          created_at
        ) VALUES (
          ${carrierSupabaseUserId},
          ${offer.carrier_user_id},
          ${action === 'accept' ? 'offer_accepted' : 'offer_rejected'},
          ${action === 'accept' ? 'Offer Accepted' : 'Offer Rejected'},
          ${action === 'accept' 
            ? `Your offer for load ${offer.load_rr_number} has been accepted!` 
            : `Your offer for load ${offer.load_rr_number} has been rejected.`},
          false,
          NOW()
        )
      `;

      // Create history record
      await sql`
        INSERT INTO offer_history (
          offer_id,
          action,
          old_status,
          new_status,
          admin_notes,
          performed_by,
          performed_at
        ) VALUES (
          ${offer.id},
          ${action},
          'pending',
          ${action === 'accept' ? 'accepted' : 'rejected'},
          ${adminNotes || null},
          'admin',
          NOW()
        )
      `;
    }

    logSecurityEvent('bulk_offer_action_performed', userId, { 
      action,
      processedCount: updateResult.length,
      offerIds: offerIds.slice(0, 10) // Log first 10 IDs for audit
    });
    
    const response = NextResponse.json({ 
      success: true, 
      processedCount: updateResult.length,
      message: `${updateResult.length} offers ${action}ed successfully` 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error processing bulk offer action:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bulk_offer_action_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
