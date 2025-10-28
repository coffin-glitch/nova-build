import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/load-matching";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/notification-preferences - Get notification preferences
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await getNotificationPreferences(userId);

    if (!preferences) {
      return NextResponse.json(
        { error: "Failed to get preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      data: preferences 
    });

  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// PUT /api/carrier/notification-preferences - Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await request.json();

    const result = await updateNotificationPreferences(userId, preferences);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Preferences updated successfully" 
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
