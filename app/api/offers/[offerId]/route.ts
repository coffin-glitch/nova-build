import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    // This will throw if user is not admin
    const auth = await requireApiAdmin(req);
    const userId = auth.userId;

    // Check rate limit for admin write operation
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

    const { offerId } = await params;
    const body = await req.json();
    const { action, counterAmount, adminNotes } = body;

    // Input validation
    const validation = validateInput(
      { offerId, action, counterAmount, adminNotes },
      {
        offerId: { required: true, type: 'string', maxLength: 50 },
        action: { required: true, type: 'string', enum: ['accept', 'reject', 'counter'] },
        counterAmount: { type: 'number', min: 0, required: false },
        adminNotes: { type: 'string', maxLength: 2000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_action_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!action || !['accept', 'reject', 'counter'].includes(action)) {
      const response = NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (action === 'counter' && !counterAmount) {
      const response = NextResponse.json(
        { error: "Counter amount required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get the current offer
    const offerResult = await sql`
      SELECT * FROM load_offers WHERE id = ${offerId}
    `;

    if (offerResult.length === 0) {
      const response = NextResponse.json(
        { error: "Offer not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const offer = offerResult[0];

    if (offer.status !== 'pending') {
      const response = NextResponse.json(
        { error: "Offer is not pending" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    let status;
    let updateResult;

    switch (action) {
      case 'accept': {
        status = 'accepted';
        updateResult = await sql`
          UPDATE load_offers 
          SET status = ${status}, admin_notes = ${adminNotes || null}, driver_info_required = true, updated_at = NOW()
          WHERE id = ${offerId}
          RETURNING *
        `;
        
        // Get supabase_user_id for notifications (Supabase-only)
        const acceptCarrierSupabaseUserId = updateResult[0].supabase_carrier_user_id || updateResult[0].carrier_user_id;
        
        // Create notification for carrier (Supabase-only)
        await sql`
          INSERT INTO carrier_notifications (
            supabase_user_id, carrier_user_id, type, title, message, priority, load_id, action_url
          ) VALUES (
            ${acceptCarrierSupabaseUserId},
            ${updateResult[0].carrier_user_id},
            'offer_accepted',
            'Offer Accepted!',
            'Your offer for load ${updateResult[0].load_rr_number} has been accepted.',
            'high',
            ${updateResult[0].id}::uuid,
            '/carrier/my-loads'
          )
        `;
        
        // Create history record
        await sql`
          INSERT INTO offer_history (
            offer_id, action, old_status, new_status, old_amount, new_amount, 
            admin_notes, performed_by, performed_at
          ) VALUES (
            ${offerId}, 'accepted', 'pending', 'accepted', 
            ${updateResult[0].offer_amount}, ${updateResult[0].offer_amount},
            ${adminNotes || null}, ${acceptCarrierSupabaseUserId}, NOW()
          )
        `;
        break;
      }
      
      case 'reject': {
        status = 'rejected';
        updateResult = await sql`
          UPDATE load_offers 
          SET status = ${status}, admin_notes = ${adminNotes || null}, updated_at = NOW()
          WHERE id = ${offerId}
          RETURNING *
        `;
        
        // Get supabase_user_id for notifications (Supabase-only)
        const rejectCarrierSupabaseUserId = updateResult[0].supabase_carrier_user_id || updateResult[0].carrier_user_id;
        
        // Create notification for carrier (Supabase-only)
        await sql`
          INSERT INTO carrier_notifications (
            supabase_user_id, carrier_user_id, type, title, message, priority, load_id, action_url
          ) VALUES (
            ${rejectCarrierSupabaseUserId},
            ${updateResult[0].carrier_user_id},
            'offer_rejected',
            'Offer Rejected',
            'Your offer for load ${updateResult[0].load_rr_number} has been rejected.',
            'medium',
            ${updateResult[0].id}::uuid,
            '/carrier/my-loads'
          )
        `;
        
        // Create history record
        await sql`
          INSERT INTO offer_history (
            offer_id, action, old_status, new_status, old_amount, new_amount, 
            admin_notes, performed_by, performed_at
          ) VALUES (
            ${offerId}, 'rejected', 'pending', 'rejected', 
            ${updateResult[0].offer_amount}, ${updateResult[0].offer_amount},
            ${adminNotes || null}, ${rejectCarrierSupabaseUserId}, NOW()
          )
        `;
        break;
      }
      
      case 'counter': {
        status = 'countered';
        updateResult = await sql`
          UPDATE load_offers 
          SET status = ${status}, counter_amount = ${counterAmount}, admin_notes = ${adminNotes || null}, updated_at = NOW()
          WHERE id = ${offerId}
          RETURNING *
        `;
        
        // Get supabase_user_id for notifications (Supabase-only)
        const counterCarrierSupabaseUserId = updateResult[0].supabase_carrier_user_id || updateResult[0].carrier_user_id;
        
        // Create notification for carrier (Supabase-only)
        await sql`
          INSERT INTO carrier_notifications (
            supabase_user_id, carrier_user_id, type, title, message, priority, load_id, action_url
          ) VALUES (
            ${counterCarrierSupabaseUserId},
            ${updateResult[0].carrier_user_id},
            'offer_countered',
            'Counter Offer Received',
            'You have received a counter offer of $${(counterAmount / 100).toFixed(2)} for load ${updateResult[0].load_rr_number}.',
            'high',
            ${updateResult[0].id}::uuid,
            '/carrier/my-loads'
          )
        `;
        
        // Create history record
        await sql`
          INSERT INTO offer_history (
            offer_id, action, old_status, new_status, old_amount, new_amount, 
            admin_notes, performed_by, performed_at
          ) VALUES (
            ${offerId}, 'countered', 'pending', 'countered', 
            ${updateResult[0].offer_amount}, ${counterAmount},
            ${adminNotes || null}, ${counterCarrierSupabaseUserId}, NOW()
          )
        `;
        break;
      }
      
      default:
        const defaultResponse = NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
        return addSecurityHeaders(defaultResponse);
    }

    logSecurityEvent('offer_action_performed', userId, { 
      offerId,
      action,
      offerStatus: updateResult[0].status
    });
    
    const response = NextResponse.json({ 
      ok: true,
      message: `Offer ${action}ed successfully`,
      offer: updateResult[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error managing offer:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_action_error', undefined, { 
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