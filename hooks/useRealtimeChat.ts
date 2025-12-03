import { useEffect, useRef, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  content: string;
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
}

interface UseRealtimeChatOptions {
  roomName: string; // Unique identifier for the chat room (conversation ID)
  userId?: string; // Current user ID
  username?: string; // Current user display name
  onMessage?: (messages: ChatMessage[]) => void; // Callback when messages are received
  onBroadcast?: (message: ChatMessage) => void; // Callback for instant broadcast messages
  enabled?: boolean;
}

/**
 * Enhanced realtime chat hook using Supabase Broadcast for instant delivery
 * and postgres_changes for persistence and reliability.
 * 
 * Based on Supabase Realtime Chat pattern:
 * https://supabase.com/ui/docs/nextjs/realtime-chat
 * 
 * Messages sent through Broadcast are:
 * - Delivered in real-time to other connected clients
 * - Not stored unless you handle persistence yourself
 * - Not guaranteed to arrive if the client disconnects
 * 
 * We use Broadcast for instant delivery, then rely on postgres_changes
 * for the actual persisted messages from the database.
 */
export function useRealtimeChat(options: UseRealtimeChatOptions = { roomName: '' }) {
  const {
    roomName,
    userId,
    username,
    onMessage,
    onBroadcast,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);
  const callbacksRef = useRef({ onMessage, onBroadcast });
  
  // Update callbacks ref when they change (without triggering re-subscription)
  useEffect(() => {
    callbacksRef.current = { onMessage, onBroadcast };
  }, [onMessage, onBroadcast]);

  useEffect(() => {
    if (!enabled || !roomName) return;
    
    // Guard against SSR/build-time execution
    if (typeof window === 'undefined') return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `chat_${roomName}_${Date.now()}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true }, // Receive own broadcasts
      },
    });

    // Subscribe to Broadcast events for instant message delivery
    channel
      .on('broadcast', { event: 'message' }, (payload) => {
        console.log('[RealtimeChat] Broadcast message received:', payload);
        
        const callbacks = callbacksRef.current;
        if (payload.payload && callbacks.onBroadcast) {
          const message: ChatMessage = {
            id: payload.payload.id || `broadcast-${Date.now()}`,
            content: payload.payload.content || payload.payload.message || '',
            user: {
              id: payload.payload.userId || payload.payload.user?.id || '',
              name: payload.payload.username || payload.payload.user?.name || 'Unknown',
            },
            createdAt: payload.payload.createdAt || new Date().toISOString(),
            attachment_url: payload.payload.attachment_url,
            attachment_type: payload.payload.attachment_type,
            attachment_name: payload.payload.attachment_name,
          };
          callbacks.onBroadcast(message);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeChat] Subscribed to broadcast channel:', roomName);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeChat] Channel error subscribing to broadcast');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, roomName]);

  /**
   * Send a message via Broadcast for instant delivery
   * This provides low-latency updates before the message is persisted to the database
   */
  const sendBroadcast = useCallback((message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    // Guard against SSR/build-time execution
    if (typeof window === 'undefined') {
      console.warn('[RealtimeChat] Cannot send broadcast: window is undefined (SSR)');
      return false;
    }
    
    if (!channelRef.current || !userId || !username) {
      console.warn('[RealtimeChat] Cannot send broadcast: channel, userId, or username missing');
      return false;
    }

    const broadcastMessage = {
      id: `temp-${Date.now()}-${Math.random()}`,
      content: message.content,
      userId,
      username,
      createdAt: new Date().toISOString(),
      attachment_url: message.attachment_url,
      attachment_type: message.attachment_type,
      attachment_name: message.attachment_name,
    };

    const status = channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: broadcastMessage,
    });

    if (status === 'ok') {
      console.log('[RealtimeChat] Broadcast message sent:', broadcastMessage);
      return true;
    } else {
      console.error('[RealtimeChat] Failed to send broadcast:', status);
      return false;
    }
  }, [userId, username]);

  return {
    sendBroadcast,
    channel: channelRef.current,
  };
}

