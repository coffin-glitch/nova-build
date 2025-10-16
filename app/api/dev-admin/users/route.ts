import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    
    console.log("🔍 Dev Admin API: Starting user fetch");
    console.log("🔑 Clerk Secret Key exists:", !!clerkSecretKey);
    console.log("🔑 Clerk Secret Key format:", clerkSecretKey?.startsWith('sk_') ? 'Valid format (sk_)' : 'Invalid format');
    console.log("🔑 Clerk Secret Key length:", clerkSecretKey?.length || 0);
    
    if (!clerkSecretKey) {
      console.error("❌ Clerk secret key not configured");
      return NextResponse.json(
        { error: "Clerk secret key not configured" },
        { status: 500 }
      );
    }

    console.log("📡 Fetching users from Clerk API...");
    
    // Fetch users from Clerk API - try different versions
    let clerkResponse;
    try {
      // Try v1 first
      clerkResponse = await fetch('https://api.clerk.com/v1/users?limit=100', {
        headers: {
          'Authorization': `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json'
        }
      });
      console.log("📡 Tried Clerk API v1, status:", clerkResponse.status);
    } catch (v1Error) {
      console.log("❌ Clerk API v1 failed, trying v0...");
      // Fallback to v0
      clerkResponse = await fetch('https://api.clerk.com/v0/users?limit=100', {
        headers: {
          'Authorization': `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json'
        }
      });
      console.log("📡 Tried Clerk API v0, status:", clerkResponse.status);
    }

    console.log("📊 Clerk API Response Status:", clerkResponse.status);
    console.log("📊 Clerk API Response OK:", clerkResponse.ok);

    if (!clerkResponse.ok) {
      const errorText = await clerkResponse.text();
      console.error("❌ Clerk API Error:", errorText);
      throw new Error(`Clerk API error: ${clerkResponse.status} - ${errorText}`);
    }

    const clerkData = await clerkResponse.json();
    console.log("📋 Clerk API Response Data:", JSON.stringify(clerkData, null, 2));
    
    // Check if the response has the expected structure
    console.log("🔍 Response structure check:");
    console.log("- Is array:", Array.isArray(clerkData));
    console.log("- Has 'data' property:", 'data' in clerkData);
    console.log("- Data type:", typeof clerkData.data);
    console.log("- Data length:", Array.isArray(clerkData.data) ? clerkData.data.length : 'not array');
    console.log("- Full response keys:", Object.keys(clerkData));
    
    // Handle both response formats: direct array or object with data property
    let clerkUsers;
    if (Array.isArray(clerkData)) {
      // Direct array response (newer Clerk API format)
      clerkUsers = clerkData;
      console.log("📊 Using direct array format");
    } else if (clerkData.data && Array.isArray(clerkData.data)) {
      // Object with data property (older format)
      clerkUsers = clerkData.data;
      console.log("📊 Using data property format");
    } else {
      // Fallback
      clerkUsers = [];
      console.log("⚠️ Unknown response format, using empty array");
    }
    
    console.log("👥 Found Clerk Users:", clerkUsers.length);
    
    // If no users found, let's see what we got
    if (clerkUsers.length === 0) {
      console.log("⚠️ No users found in Clerk response!");
      console.log("📊 Response status:", clerkResponse.status);
      console.log("📊 Response headers:", Object.fromEntries(clerkResponse.headers.entries()));
      console.log("📊 Full response body:", JSON.stringify(clerkData, null, 2));
    }

    // Get user roles from our database - try both column names
    console.log("🗄️ Fetching user roles from database...");
    let userRoles;
    try {
      // Try with 'user_id' first (newer schema)
      userRoles = await sql`
        SELECT 
          user_id,
          role,
          created_at
        FROM user_roles
      `;
      console.log("📊 Found user roles with 'user_id' column:", userRoles.length);
    } catch (error) {
      console.log("❌ 'user_id' column not found, trying 'clerk_user_id'...");
      try {
        // Fallback to 'clerk_user_id' (older schema)
        userRoles = await sql`
          SELECT 
            clerk_user_id as user_id,
            role,
            created_at
          FROM user_roles
        `;
        console.log("📊 Found user roles with 'clerk_user_id' column:", userRoles.length);
      } catch (fallbackError) {
        console.log("❌ user_roles table doesn't exist, creating it...");
        // Create the table if it doesn't exist
        await sql`
          CREATE TABLE IF NOT EXISTS user_roles (
            user_id TEXT PRIMARY KEY,
            role TEXT NOT NULL CHECK (role IN ('admin', 'carrier')),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        await sql`
          CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role)
        `;
        userRoles = [];
        console.log("✅ Created user_roles table");
      }
    }

    // Create a map of user roles
    const roleMap = new Map();
    userRoles.forEach((ur: any) => {
      roleMap.set(ur.user_id, ur.role);
    });

    // Combine Clerk user data with our role data
    console.log("🔄 Combining Clerk data with role data...");
    const users = clerkUsers.map((clerkUser: any) => {
      const user = {
        id: clerkUser.id,
        email: clerkUser.email_addresses?.[0]?.email_address || 'No email',
        firstName: clerkUser.first_name || '',
        lastName: clerkUser.last_name || '',
        role: roleMap.get(clerkUser.id) || 'none',
        createdAt: clerkUser.created_at,
        lastSignIn: clerkUser.last_sign_in_at,
        profileImageUrl: clerkUser.profile_image_url,
        hasImage: !!clerkUser.profile_image_url
      };
      console.log("👤 Processed user:", user.email, "Role:", user.role);
      return user;
    });

    console.log("✅ Returning", users.length, "users to frontend");
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
