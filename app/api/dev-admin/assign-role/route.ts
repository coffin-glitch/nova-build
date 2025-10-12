import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await request.json();
    
    if (!userId || !role || !["admin", "carrier"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid userId or role" },
        { status: 400 }
      );
    }
    
    console.log("🎯 Assigning role:", role, "to user:", userId);
    
    // Try to insert/update with 'user_id' first, fallback to 'clerk_user_id'
    try {
      await sql`
        INSERT INTO user_roles (user_id, role, created_at)
        VALUES (${userId}, ${role}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET 
          role = ${role}
      `;
      console.log("✅ Role assigned successfully with 'user_id' column");
    } catch (error) {
      console.log("❌ 'user_id' column failed, trying 'clerk_user_id'...");
      try {
        await sql`
          INSERT INTO user_roles (clerk_user_id, role, created_at)
          VALUES (${userId}, ${role}, NOW())
          ON CONFLICT (clerk_user_id)
          DO UPDATE SET 
            role = ${role}
        `;
        console.log("✅ Role assigned successfully with 'clerk_user_id' column");
      } catch (fallbackError) {
        console.log("❌ Both column names failed, creating table...");
        // Create table and try again
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
        await sql`
          INSERT INTO user_roles (user_id, role, created_at)
          VALUES (${userId}, ${role}, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET 
            role = ${role}
        `;
        console.log("✅ Created table and assigned role");
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Role ${role} assigned to user ${userId}` 
    });
  } catch (error: any) {
    console.error("Assign role error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
