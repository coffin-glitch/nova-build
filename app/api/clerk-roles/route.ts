import { getClerkUserRole, isClerkAdmin, setClerkUserRole } from "@/lib/clerk-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
    const isAdmin = await isClerkAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { targetUserId, role } = await request.json();
    
    if (!targetUserId || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (role !== "admin" && role !== "carrier") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Set the role in Clerk
    await setClerkUserRole(targetUserId, role);

    return NextResponse.json({ 
      success: true, 
      message: `User role updated to ${role}` 
    });

  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json({ 
      error: "Failed to update user role" 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    const action = searchParams.get("action");

    if (action === "list") {
      // Check if current user is admin
      const isAdmin = await isClerkAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // List all users with their roles
      const { users } = await import("@clerk/clerk-sdk-node");
      const clerkUsers = await users.getUserList();
      
      const usersWithRoles = clerkUsers.map(user => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: (user.publicMetadata?.role as string) || "carrier",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      }));

      return NextResponse.json({ users: usersWithRoles });
    }

    if (action === "make-admin") {
      // Special action to make current user admin (for development)
      await setClerkUserRole(userId, "admin");
      return NextResponse.json({ 
        success: true, 
        message: "Current user role set to admin" 
      });
    }

    if (!targetUserId || !action) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (action === "check") {
      const role = await getClerkUserRole(targetUserId);
      return NextResponse.json({
        role,
        isAdmin: role === "admin",
        isCarrier: role === "carrier" || role === "admin",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Error in clerk-roles API:", error);
    return NextResponse.json({ 
      error: "Failed to process request" 
    }, { status: 500 });
  }
}
