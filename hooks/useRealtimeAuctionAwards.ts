import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeAuctionAwardsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  bidNumber?: string; // Filter by specific bid number
  userId?: string; // Filter by winner user ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on auction_awards table
 * Provides instant updates for bid award results
 */
export function useRealtimeAuctionAwards(options: UseRealtimeAuctionAwardsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    bidNumber,
    userId,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `auction_awards_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (bidNumber && userId) {
      filter = `bid_number=eq.${bidNumber}&winner_user_id=eq.${userId}`;
    } else if (bidNumber) {
      filter = `bid_number=eq.${bidNumber}`;
    } else if (userId) {
      filter = `winner_user_id=eq.${userId}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'auction_awards',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] auction_awards change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to auction_awards');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to auction_awards');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, bidNumber, userId, onInsert, onUpdate, onDelete]);
}

