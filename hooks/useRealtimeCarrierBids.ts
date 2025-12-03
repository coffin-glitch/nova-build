import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeCarrierBidsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by carrier user ID
  bidNumber?: string; // Filter by specific bid number
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on carrier_bids table
 * Provides instant updates for bid submissions and status changes
 */
export function useRealtimeCarrierBids(options: UseRealtimeCarrierBidsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    bidNumber,
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
    
    const channelName = `carrier_bids_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (userId && bidNumber) {
      filter = `supabase_user_id=eq.${userId}&bid_number=eq.${bidNumber}`;
    } else if (userId) {
      filter = `supabase_user_id=eq.${userId}`;
    } else if (bidNumber) {
      filter = `bid_number=eq.${bidNumber}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'carrier_bids',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] carrier_bids change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to carrier_bids');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to carrier_bids');
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
  }, [enabled, userId, bidNumber, onInsert, onUpdate, onDelete]);
}
