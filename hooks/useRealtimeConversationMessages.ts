import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeConversationMessagesOptions {
  conversationId?: string; // Filter by specific conversation ID
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on conversation_messages table
 * Provides instant message updates for active conversations
 */
export function useRealtimeConversationMessages(options: UseRealtimeConversationMessagesOptions = {}) {
  const {
    conversationId,
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options;

  // FIXED: Use RealtimeChannel type directly instead of ReturnType<typeof getSupabaseBrowser>
  // This prevents module-level type evaluation that can cause circular dependency issues
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });
  
  // Update callbacks ref when they change (without triggering re-subscription)
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled || !conversationId) return;
    
    // Guard against SSR/build-time execution
    if (typeof window === 'undefined') return;

    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch (error) {
      console.error('[useRealtimeConversationMessages] Error getting Supabase client:', error);
      return;
    }
    
    const channelName = `conversation_messages_${conversationId}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'conversation_messages',
      filter: `conversation_id=eq.${conversationId}`,
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] conversation_messages change:', payload.eventType, payload);
        
        // Use ref to get latest callbacks without re-subscribing
        const callbacks = callbacksRef.current;
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onInsert?.(payload);
            break;
          case 'UPDATE':
            callbacks.onUpdate?.(payload);
            break;
          case 'DELETE':
            callbacks.onDelete?.(payload);
            break;
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to conversation_messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to conversation_messages');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.warn('[useRealtimeConversationMessages] Error removing channel:', error);
        }
        channelRef.current = null;
      }
    };
  }, [enabled, conversationId]); // Removed callbacks from dependencies
}
