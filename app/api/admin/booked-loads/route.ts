import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get loads that have accepted offers today
    // For now, return 0 since we don't have a proper offers system yet
    const bookedLoads: any[] = [];

    // Get summary stats
    const totalBooked = bookedLoads.length;
    const totalRevenue = bookedLoads.reduce((sum, load) => sum + (load.rate || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        bookedLoads,
        summary: {
          totalBooked,
          totalRevenue
        }
      }
    });

  } catch (error) {
    console.error("Error fetching booked loads:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch booked loads" },
      { status: 500 }
    );
  }
}
