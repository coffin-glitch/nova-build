import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { getSupabaseService } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
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
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const { conversationId } = await params;

    // SECURITY FIX: Verify the user has access to this conversation
    // Only allow access if:
    // 1. User is admin_user_id (they created/own the conversation), OR
    // 2. User is carrier_user_id AND it's an admin-to-admin chat (both users are admins)
    const conversation = await sql`
      SELECT id, supabase_admin_user_id, supabase_carrier_user_id FROM conversations 
      WHERE id = ${conversationId} 
        AND (
          supabase_admin_user_id = ${userId}
          OR (
            supabase_carrier_user_id = ${userId} 
            AND EXISTS (
              SELECT 1 FROM user_roles_cache ur1 
              WHERE ur1.supabase_user_id = ${userId} AND ur1.role = 'admin'
            )
            AND EXISTS (
              SELECT 1 FROM user_roles_cache ur2 
              WHERE ur2.supabase_user_id = supabase_admin_user_id 
              AND ur2.role = 'admin'
            )
          )
        )
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Get messages for this conversation
    const messages = await sql`
      SELECT 
        cm.id,
        cm.conversation_id,
        cm.supabase_sender_id as sender_id,
        cm.sender_type,
        cm.message,
        cm.attachment_url,
        cm.attachment_type,
        cm.attachment_name,
        cm.attachment_size,
        cm.created_at,
        cm.updated_at,
        CASE WHEN mr.id IS NOT NULL THEN true ELSE false END as is_read
      FROM conversation_messages cm
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.supabase_user_id = ${userId}
      WHERE cm.conversation_id = ${conversationId}
      ORDER BY cm.created_at ASC
    `;

    logSecurityEvent('admin_conversation_messages_accessed', userId, { conversationId });
    
    const response = NextResponse.json({ 
      ok: true, 
      data: messages 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Error fetching admin conversation messages:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_conversation_messages_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch conversation messages",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { conversationId } = await params;

    // Check content type to determine if this is a file upload
    const contentType = request.headers.get('content-type') || '';
    const isFileUpload = contentType.includes('multipart/form-data');

    // Check rate limit (file uploads have stricter limits, admin routes are generous)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: isFileUpload ? 'fileUpload' : 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many ${isFileUpload ? 'file uploads' : 'requests'}. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    // Input validation
    const validation = validateInput(
      { conversationId },
      {
        conversationId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_conversation_post_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // SECURITY FIX: Verify the user has access to this conversation
    // Only allow access if:
    // 1. User is admin_user_id (they created/own the conversation), OR
    // 2. User is carrier_user_id AND it's an admin-to-admin chat (both users are admins)
    const conversation = await sql`
      SELECT id, supabase_admin_user_id, supabase_carrier_user_id FROM conversations 
      WHERE id = ${conversationId} 
        AND (
          supabase_admin_user_id = ${userId}
          OR (
            supabase_carrier_user_id = ${userId} 
            AND EXISTS (
              SELECT 1 FROM user_roles_cache ur1 
              WHERE ur1.supabase_user_id = ${userId} AND ur1.role = 'admin'
            )
            AND EXISTS (
              SELECT 1 FROM user_roles_cache ur2 
              WHERE ur2.supabase_user_id = supabase_admin_user_id 
              AND ur2.role = 'admin'
            )
          )
        )
    `;

    if (conversation.length === 0) {
      logSecurityEvent('conversation_not_found_post', userId, { conversationId });
      const response = NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    // Check if request has FormData (file upload) or JSON (text message)
    // contentType already declared above
    let message = '';
    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;
    let attachmentSize: number | null = null;

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      message = (formData.get('message') as string) || '';

      if (!file && !message.trim()) {
        return NextResponse.json({ 
          error: "Either a message or file is required" 
        }, { status: 400 });
      }

      if (file) {
        // Validate file size (max 10MB)
        const { validateFileSize } = await import('@/lib/api-security');
        const maxSize = 10 * 1024 * 1024; // 10MB
        const fileSizeError = validateFileSize(file, maxSize);
        if (fileSizeError) {
          logSecurityEvent('admin_file_upload_size_exceeded', userId, { 
            conversationId, 
            fileSize: file.size,
            fileName: file.name
          });
          return fileSizeError;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
          logSecurityEvent('admin_file_upload_invalid_type', userId, { 
            conversationId, 
            fileType: file.type,
            fileName: file.name
          });
          const response = NextResponse.json(
            { error: "Invalid file type. Only JPEG, PNG, and PDF are allowed" },
            { status: 400 }
          );
          return addSecurityHeaders(response, request);
        }

        // Upload file to Supabase Storage
        const supabase = getSupabaseService();
        
        // Sanitize filename - remove/replace special characters that cause issues
        const sanitizedFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
          .replace(/\s+/g, '_') // Replace spaces with underscore
          .replace(/_{2,}/g, '_') // Replace multiple underscores with single
          .toLowerCase();
        
        const fileName = `${conversationId}/${userId}/${Date.now()}_${sanitizedFileName}`;
        const filePath = fileName; // Don't include bucket name - .from() handles that

        // Ensure bucket exists
        try {
          const { data: buckets, error: listError } = await supabase.storage.listBuckets();
          if (listError) {
            console.error('Error listing buckets:', listError);
            throw listError;
          }
          
          const bucketExists = buckets?.some(b => b.name === 'chat-attachments');
          if (!bucketExists) {
            const { error: createError } = await supabase.storage.createBucket('chat-attachments', {
              public: true,
              fileSizeLimit: 10485760, // 10MB
              allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
            });
            if (createError) {
              console.error('Error creating bucket:', createError);
              // If bucket already exists (race condition), that's okay
              if (!createError.message.includes('already exists')) {
                throw createError;
              }
            }
          }
        } catch (bucketError: any) {
          console.error('Error checking/creating bucket:', bucketError);
          return NextResponse.json(
            { error: `Failed to setup storage bucket: ${bucketError.message || 'Unknown error'}` },
            { status: 500 }
          );
        }

        // Upload file
        const fileBuffer = await file.arrayBuffer();
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, fileBuffer, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          return NextResponse.json(
            { error: `Failed to upload file: ${uploadError.message || 'Unknown error'}` },
            { status: 500 }
          );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);

        attachmentUrl = urlData.publicUrl;
        attachmentType = file.type;
        attachmentName = file.name;
        attachmentSize = file.size;
      }
    } else {
      // Handle text-only message
      const body = await request.json();
      message = body.message || '';

      if (!message.trim()) {
        return NextResponse.json({ 
          error: "Missing required field: message" 
        }, { status: 400 });
      }
    }

    // Create new message (Supabase-only)
    const result = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        supabase_sender_id,
        sender_type,
        message,
        attachment_url,
        attachment_type,
        attachment_name,
        attachment_size,
        created_at,
        updated_at
      ) VALUES (
        ${conversationId}, 
        ${userId}, 
        'admin', 
        ${message || ''}, 
        ${attachmentUrl}, 
        ${attachmentType}, 
        ${attachmentName}, 
        ${attachmentSize}, 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      )
      RETURNING id, created_at
    `;

    // Notify carrier about new admin message
    try {
      const { getConversationDetails, createNotification } = await import('@/lib/notifications');
      
      const conversationDetails = await getConversationDetails(conversationId);
      if (conversationDetails?.carrierUserId) {
        // Create message preview (first 100 chars)
        const messagePreview = message 
          ? (message.length > 100 ? message.substring(0, 100) + '...' : message)
          : (attachmentName ? `Sent ${attachmentName}` : 'Sent an attachment');
        
        await createNotification(
          conversationDetails.carrierUserId,
          'admin_message',
          '💬 New Message from Admin',
          `Admin sent: ${messagePreview}`,
          {
            conversation_id: conversationId,
            admin_user_id: userId,
            message_id: result[0].id,
            has_attachment: !!attachmentUrl
          }
        );
      }
    } catch (notificationError) {
      console.error('Failed to create carrier notification for admin message:', notificationError);
      // Don't throw - message sending should still succeed
    }

    logSecurityEvent('admin_conversation_message_sent', userId, { 
      conversationId, 
      hasAttachment: !!attachmentUrl,
      messageLength: message.length
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Message sent successfully",
      data: result[0]
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Error sending admin message:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_conversation_message_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to send message",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
