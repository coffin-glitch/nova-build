import { NextRequest, NextResponse } from "next/server";
import { WebSocketServer } from 'ws';

// Global WebSocket server instance
let wss: WebSocketServer | null = null;
let server: any = null;
let telegramProcess: any = null;

export async function GET(request: NextRequest) {
  try {
    // In production, proxy to Railway service
    if (process.env.NODE_ENV === 'production') {
      const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
      if (!railwayUrl) {
        return NextResponse.json({ error: 'Railway URL not configured' }, { status: 500 });
      }
      
      const response = await fetch(`${railwayUrl}/status`);
      const data = await response.json();
      return NextResponse.json(data);
    }

    // In development, return local status
    return NextResponse.json({ 
      status: 'running',
      message: 'Development mode - connect to Railway service'
    });

  } catch (error) {
    console.error('Error getting telegram forwarder status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    // In production, proxy to Railway service
    if (process.env.NODE_ENV === 'production') {
      const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
      if (!railwayUrl) {
        return NextResponse.json({ error: 'Railway URL not configured' }, { status: 500 });
      }
      
      const response = await fetch(`${railwayUrl}/telegram-forwarder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      
      const data = await response.json();
      return NextResponse.json(data);
    }

    // In development, return mock response
    return NextResponse.json({ 
      status: action === 'start' ? 'started' : 'stopped',
      message: `Development mode - ${action} command sent to Railway service`
    });

  } catch (error) {
    console.error('Error handling telegram forwarder action:', error);
    return NextResponse.json(
      { error: 'Failed to handle action' },
      { status: 500 }
    );
  }
}
