"use client";

import { Badge } from "@/components/ui/badge";
import { useRealtimeAnnouncementReads } from "@/hooks/useRealtimeAnnouncementReads";
import { useRealtimeAnnouncements } from "@/hooks/useRealtimeAnnouncements";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnnouncementsNavLink() {
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

  return (
    <Link
      href="/announcements"
      className="relative inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
    >
      <Megaphone className="mr-2 w-4 h-4" />
      Announcements
      {unreadCount > 0 && (
        <Badge
          variant="default"
          className="ml-2 h-5 min-w-[20px] px-1.5 text-xs"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Link>
  );
}

