import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeMessageReadsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by user ID
  messageId?: string; // Filter by specific message ID
  conversationId?: string; // Filter by conversation ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on message_reads table
 * Provides instant updates for read receipts
 */
export function useRealtimeMessageReads(options: UseRealtimeMessageReadsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    messageId,
    conversationId,
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
    
    const channelName = `message_reads_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (userId && conversationId) {
      filter = `user_id=eq.${userId}&conversation_id=eq.${conversationId}`;
    } else if (userId && messageId) {
      filter = `user_id=eq.${userId}&message_id=eq.${messageId}`;
    } else if (userId) {
      filter = `user_id=eq.${userId}`;
    } else if (conversationId) {
      filter = `conversation_id=eq.${conversationId}`;
    } else if (messageId) {
      filter = `message_id=eq.${messageId}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'message_reads',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] message_reads change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to message_reads');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to message_reads');
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
  }, [enabled, userId, messageId, conversationId, onInsert, onUpdate, onDelete]);
}
