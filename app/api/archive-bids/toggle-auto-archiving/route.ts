import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enabled = body?.enabled ?? true;

    if (enabled) {
      // Enable the cron job
      const result = await sql`
        UPDATE cron.job
        SET enabled = true
        WHERE jobname = 'end-of-day-archive'
        RETURNING jobname
      `;

      if (result.length === 0) {
        // Create the cron job if it doesn't exist
        await sql`
          SELECT cron.schedule(
            'end-of-day-archive',
            '59 59 23 * * *',
            $$SELECT set_end_of_day_archived_timestamps()$$
          )
        `;
      }

      return NextResponse.json({
        ok: true,
        enabled: true,
        message: 'Auto-archiving enabled'
      });
    } else {
      // Disable the cron job
      await sql`
        UPDATE cron.job
        SET enabled = false
        WHERE jobname = 'end-of-day-archive'
        RETURNING jobname
      `;

      return NextResponse.json({
        ok: true,
        enabled: false,
        message: 'Auto-archiving disabled'
      });
    }
  } catch (error) {
    console.error("Error toggling auto-archiving:", error);
    return NextResponse.json(
      { error: "Failed to toggle auto-archiving", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

