import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;
    const { bidNumber } = await params;

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { 
          required: true, 
          type: 'string', 
          pattern: /^[A-Z0-9\-_]+$/,
          maxLength: 100
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_document_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!bidNumber) {
      const response = NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the carrier has this bid awarded to them
    const bidCheck = await sql`
      SELECT cb.id
      FROM carrier_bids cb
      JOIN auction_awards aa ON cb.bid_number = aa.bid_number
      WHERE cb.bid_number = ${bidNumber}
        AND cb.supabase_user_id = ${userId}
        AND aa.supabase_winner_user_id = ${userId}
    `;

    if (bidCheck.length === 0) {
      return NextResponse.json(
        { error: "Bid not found or not awarded to you" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const documentType = formData.get("documentType") as string;
    const notes = formData.get("notes") as string | null;

    if (!file) {
      const response = NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!documentType) {
      const response = NextResponse.json(
        { error: "Document type is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      logSecurityEvent('bid_document_size_exceeded', userId, { 
        bidNumber, 
        fileSize: file.size,
        fileName: file.name
      });
      const response = NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      logSecurityEvent('bid_document_invalid_type', userId, { 
        bidNumber, 
        fileType: file.type,
        fileName: file.name
      });
      const response = NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and PDF are allowed" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Upload file to Supabase Storage
    const supabase = getSupabaseService();
    const fileName = `${bidNumber}/${userId}/${Date.now()}_${file.name}`;
    const filePath = `bid-documents/${fileName}`;

    // Ensure bucket exists (create if needed)
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (!listError) {
        const bucketExists = buckets?.some(b => b.name === 'bid-documents');
        if (!bucketExists) {
          // Create bucket if it doesn't exist
          const { error: createError } = await supabase.storage.createBucket('bid-documents', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
          });
          if (createError && !createError.message.includes('already exists')) {
            console.error('Error creating bucket:', createError);
          }
        }
      }
    } catch (bucketError) {
      console.error('Error checking bucket:', bucketError);
      // Continue anyway - bucket might already exist
    }

    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bid-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      logSecurityEvent('bid_document_upload_error', userId, { 
        bidNumber, 
        error: uploadError.message 
      });
      const response = NextResponse.json(
        { 
          error: "Failed to upload file to storage",
          details: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        },
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('bid-documents')
      .getPublicUrl(filePath);

    // Save document record to database
    const result = await sql`
      INSERT INTO bid_documents (
        bid_number,
        carrier_user_id,
        document_type,
        file_name,
        file_url,
        file_size,
        mime_type,
        notes
      )
      VALUES (
        ${bidNumber},
        ${userId},
        ${documentType},
        ${file.name},
        ${urlData.publicUrl},
        ${file.size},
        ${file.type},
        ${notes || null}
      )
      RETURNING *
    `;

    logSecurityEvent('bid_document_uploaded', userId, { 
      bidNumber, 
      documentType,
      fileSize: file.size,
      documentId: result[0].id
    });
    
    const response = NextResponse.json({
      success: true,
      data: result[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error uploading document:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_document_upload_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        success: false,
        error: "Failed to upload document",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;
    const { bidNumber } = await params;

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { 
          required: true, 
          type: 'string', 
          pattern: /^[A-Z0-9\-_]+$/,
          maxLength: 100
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_document_fetch_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get documents for this bid that belong to this carrier
    const documents = await sql`
      SELECT *
      FROM bid_documents
      WHERE bid_number = ${bidNumber}
        AND carrier_user_id = ${userId}
      ORDER BY uploaded_at DESC
    `;

    const response = NextResponse.json({
      success: true,
      data: documents
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching documents:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_document_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        success: false,
        error: "Failed to fetch documents",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

