import { requireApiCarrier } from "@/lib/auth-api-helper";
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

    if (!bidNumber) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!documentType) {
      return NextResponse.json(
        { error: "Document type is required" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and PDF are allowed" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Failed to upload file to storage", details: uploadError.message },
        { status: 500 }
      );
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

    return NextResponse.json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload document",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
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

    // Get documents for this bid that belong to this carrier
    const documents = await sql`
      SELECT *
      FROM bid_documents
      WHERE bid_number = ${bidNumber}
        AND carrier_user_id = ${userId}
      ORDER BY uploaded_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch documents",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

