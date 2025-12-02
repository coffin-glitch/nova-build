import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeBidMessagesOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  bidNumber?: string; // Filter by specific bid number
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on bid_messages table
 * Provides instant updates for bid-specific messages
 */
export function useRealtimeBidMessages(options: UseRealtimeBidMessagesOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    bidNumber,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `bid_messages_${Date.now()}`;
    const channel = supabase.channel(channelName);

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'bid_messages',
      ...(bidNumber && { filter: `bid_number=eq.${bidNumber}` }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] bid_messages change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to bid_messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to bid_messages');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, bidNumber, onInsert, onUpdate, onDelete]);
}

