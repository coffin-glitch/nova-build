import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { clearCarrierRelatedCaches } from "@/lib/cache-invalidation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const { userId } = await params;

    // Input validation
    const validation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_get_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get carrier profile with email
    const profiles = await sql`
      SELECT 
        cp.supabase_user_id as id,
        cp.supabase_user_id as user_id,
        cp.legal_name,
        cp.company_name,
        cp.mc_number,
        cp.dot_number,
        cp.contact_name,
        cp.phone,
        cp.profile_status,
        cp.created_at,
        cp.updated_at
      FROM carrier_profiles cp
      WHERE cp.supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (profiles.length === 0) {
      logSecurityEvent('carrier_not_found', adminUserId, { userId });
      const response = NextResponse.json({ 
        error: "Carrier not found" 
      }, { status: 404 });
      return addSecurityHeaders(response);
    }

    const carrier = profiles[0];

    // Get email from user_roles_cache or Supabase
    let email = 'N/A';
    try {
      const cacheResult = await sql`
        SELECT email FROM user_roles_cache WHERE supabase_user_id = ${userId} LIMIT 1
      `;
      
      if (cacheResult.length > 0 && cacheResult[0].email) {
        email = cacheResult[0].email;
      } else {
        // Fallback to Supabase Auth
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
          
          if (!error && user?.email) {
            email = user.email;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching email for user ${userId}:`, error);
    }

    logSecurityEvent('carrier_profile_accessed', adminUserId, { carrierUserId: userId });
    
    const response = NextResponse.json({ 
      ok: true, 
      data: {
        ...carrier,
        email,
        company_name: carrier.legal_name || carrier.company_name || 'N/A'
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching carrier profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_profile_get_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch profile",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const { userId: carrierUserId } = await params;

    // Input validation for userId
    const userIdValidation = validateInput(
      { carrierUserId },
      {
        carrierUserId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!userIdValidation.valid) {
      logSecurityEvent('invalid_carrier_update_userid', adminUserId, { errors: userIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${userIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    const {
      company_name,
      mc_number,
      dot_number,
      contact_name,
      phone
    } = body;

    // Input validation for body
    const bodyValidation = validateInput(
      { company_name, mc_number, dot_number, contact_name, phone },
      {
        company_name: { type: 'string', maxLength: 200, required: false },
        mc_number: { type: 'string', maxLength: 20, required: false },
        dot_number: { type: 'string', maxLength: 20, required: false },
        contact_name: { type: 'string', maxLength: 200, required: false },
        phone: { type: 'string', maxLength: 50, required: false }
      }
    );

    if (!bodyValidation.valid) {
      logSecurityEvent('invalid_carrier_update_body', adminUserId, { errors: bodyValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${bodyValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Update carrier profile (Supabase-only)
    await sql`
      UPDATE carrier_profiles SET
        legal_name = ${company_name},
        company_name = ${company_name},
        mc_number = ${mc_number},
        dot_number = ${dot_number},
        contact_name = ${contact_name},
        phone = ${phone},
        updated_at = NOW()
      WHERE supabase_user_id = ${carrierUserId}
    `;

    // Clear caches to ensure updated data appears immediately
    await clearCarrierRelatedCaches(carrierUserId);

    logSecurityEvent('carrier_profile_updated', adminUserId, { carrierUserId });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Profile updated successfully" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating carrier profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_profile_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to update profile",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
