"use client";

import { Badge } from "@/components/ui/badge";
import { useRealtimeAnnouncementReads } from "@/hooks/useRealtimeAnnouncementReads";
import { useRealtimeAnnouncements } from "@/hooks/useRealtimeAnnouncements";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnnouncementsBadge() {
  const { user } = useUnifiedUser();
  const { data, mutate } = useSWR(
    "/api/announcements/unread-count",
    fetcher,
    {
      refreshInterval: 60000, // Reduced from 30s - Realtime handles instant updates
      revalidateOnFocus: true,
    }
  );

  // Realtime updates for announcements
  useRealtimeAnnouncements({
    onInsert: () => {
      mutate();
    },
    onUpdate: () => {
      mutate();
    },
    onDelete: () => {
      mutate();
    },
    enabled: true,
  });

  // Realtime updates for announcement_reads
  useRealtimeAnnouncementReads({
    userId: user?.id,
    onInsert: () => {
      mutate();
    },
    onUpdate: () => {
      mutate();
    },
    onDelete: () => {
      mutate();
    },
    enabled: !!user,
  });

  const unreadCount = data?.unreadCount || 0;

  if (unreadCount === 0) return null;

  return (
    <Badge
      variant="default"
      className="ml-2 h-5 min-w-[20px] px-1.5 text-xs"
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </Badge>
  );
}

