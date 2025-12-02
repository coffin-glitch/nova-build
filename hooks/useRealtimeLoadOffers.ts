import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeLoadOffersOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by carrier user ID
  loadId?: string; // Filter by specific load ID
  offerId?: string; // Filter by specific offer ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on load_offers table
 * Provides instant updates for load offers and status changes
 */
export function useRealtimeLoadOffers(options: UseRealtimeLoadOffersOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    loadId,
    offerId,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `load_offers_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (userId && loadId) {
      filter = `carrier_user_id=eq.${userId}&load_id=eq.${loadId}`;
    } else if (userId && offerId) {
      filter = `carrier_user_id=eq.${userId}&id=eq.${offerId}`;
    } else if (userId) {
      filter = `carrier_user_id=eq.${userId}`;
    } else if (loadId) {
      filter = `load_id=eq.${loadId}`;
    } else if (offerId) {
      filter = `id=eq.${offerId}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'load_offers',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] load_offers change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to load_offers');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to load_offers');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, loadId, offerId, onInsert, onUpdate, onDelete]);
}

