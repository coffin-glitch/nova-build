import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeCarrierResponsesOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by carrier user ID
  messageId?: string; // Filter by specific message ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on carrier_responses table
 * Provides instant updates for carrier responses to admin messages
 */
export function useRealtimeCarrierResponses(options: UseRealtimeCarrierResponsesOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    messageId,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `carrier_responses_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (userId && messageId) {
      filter = `carrier_user_id=eq.${userId}&message_id=eq.${messageId}`;
    } else if (userId) {
      filter = `carrier_user_id=eq.${userId}`;
    } else if (messageId) {
      filter = `message_id=eq.${messageId}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'carrier_responses',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] carrier_responses change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to carrier_responses');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to carrier_responses');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, messageId, onInsert, onUpdate, onDelete]);
}

