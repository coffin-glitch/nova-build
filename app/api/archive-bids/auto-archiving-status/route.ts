import sql from '@/lib/db';
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check if the cron job exists and is active
    const result = await sql`
      SELECT 
        jobname,
        enabled,
        schedule
      FROM cron.job
      WHERE jobname = 'end-of-day-archive'
    `;

    const job = result[0];
    const enabled = job?.enabled ?? false;

    return NextResponse.json({
      ok: true,
      enabled,
      message: enabled ? 'Auto-archiving is enabled' : 'Auto-archiving is disabled'
    });
  } catch (error) {
    console.error("Error fetching auto-archiving status:", error);
    return NextResponse.json(
      { ok: true, enabled: false, error: "Could not fetch status" },
      { status: 200 }
    );
  }
}

