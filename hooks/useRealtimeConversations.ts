import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeConversationsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by user ID (carrier_user_id or admin_user_id)
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on conversations table
 * Useful for live conversation list updates
 */
export function useRealtimeConversations(options: UseRealtimeConversationsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });
  
  // Update callbacks ref when they change (without triggering re-subscription)
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `conversations_${Date.now()}`;
    const channel = supabase.channel(channelName);

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'conversations',
      ...(userId && { filter: `carrier_user_id=eq.${userId}` }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] conversations change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to conversations');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to conversations');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId]); // Removed callbacks from dependencies
}

