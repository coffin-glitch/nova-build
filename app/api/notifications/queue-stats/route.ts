import { NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/notification-queue';

export async function GET() {
  try {
    const stats = await getQueueStats();
    return NextResponse.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: 'Failed to get queue stats. Check REDIS_URL is configured.',
      },
      { status: 500 }
    );
  }
}

