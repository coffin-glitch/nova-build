import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

interface UseRealtimeBidsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  filter?: string; // e.g., 'published=eq.true'
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on telegram_bids table
 * Replaces SWR polling with WebSocket subscriptions
 */
export function useRealtimeBids(options: UseRealtimeBidsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    filter,
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
    
    // Create a unique channel name to avoid conflicts
    const channelName = `telegram_bids_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to all changes (INSERT, UPDATE, DELETE)
    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'telegram_bids',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] telegram_bids change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to telegram_bids');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to telegram_bids');
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Channel closed');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, filter]); // Removed callbacks from dependencies
}

