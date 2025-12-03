import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeAnnouncementReadsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by user ID
  announcementId?: string; // Filter by specific announcement ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on announcement_reads table
 * Provides instant updates for announcement read status
 */
export function useRealtimeAnnouncementReads(options: UseRealtimeAnnouncementReadsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    announcementId,
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
    
    const channelName = `announcement_reads_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (userId && announcementId) {
      filter = `user_id=eq.${userId}&announcement_id=eq.${announcementId}`;
    } else if (userId) {
      filter = `user_id=eq.${userId}`;
    } else if (announcementId) {
      filter = `announcement_id=eq.${announcementId}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'announcement_reads',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] announcement_reads change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to announcement_reads');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to announcement_reads');
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
  }, [enabled, userId, announcementId, onInsert, onUpdate, onDelete]);
}
