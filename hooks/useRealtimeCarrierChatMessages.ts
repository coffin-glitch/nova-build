import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeCarrierChatMessagesOptions {
  userId?: string; // Filter by carrier user ID
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on carrier_chat_messages table
 * Provides instant updates for carrier chat messages
 */
export function useRealtimeCarrierChatMessages(options: UseRealtimeCarrierChatMessagesOptions = {}) {
  const {
    userId,
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Guard against SSR/build-time execution
    if (typeof window === 'undefined') return;

    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch (error) {
      console.error('[] Error getting Supabase client:', error);
      return;
    }
    
    const channelName = `carrier_chat_messages_${Date.now()}`;
    const channel = supabase.channel(channelName);

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'carrier_chat_messages',
      ...(userId && { filter: `supabase_user_id=eq.${userId}` }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] carrier_chat_messages change:', payload.eventType, payload);
        
        switch (payload.eventType) {
          case 'INSERT':
            onInsert?.(payload);
            break;
          case 'UPDATE':
            onUpdate?.(payload);
            break;
          case 'DELETE':
            onDelete?.(payload);
            break;
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to carrier_chat_messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to carrier_chat_messages');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        try {
        supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.warn('[] Error removing channel:', error);
        }
        channelRef.current = null;
      }
    };
  }, [enabled, userId, onInsert, onUpdate, onDelete]);
}
