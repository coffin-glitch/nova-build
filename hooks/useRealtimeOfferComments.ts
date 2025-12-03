import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOfferCommentsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  offerId?: string; // Filter by specific offer ID
  userId?: string; // Filter by user ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on offer_comments table
 * Provides instant updates for offer comments
 */
export function useRealtimeOfferComments(options: UseRealtimeOfferCommentsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    offerId,
    userId,
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
    
    const channelName = `offer_comments_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (offerId && userId) {
      filter = `offer_id=eq.${offerId}&user_id=eq.${userId}`;
    } else if (offerId) {
      filter = `offer_id=eq.${offerId}`;
    } else if (userId) {
      filter = `user_id=eq.${userId}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'offer_comments',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] offer_comments change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to offer_comments');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to offer_comments');
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
  }, [enabled, offerId, userId, onInsert, onUpdate, onDelete]);
}
