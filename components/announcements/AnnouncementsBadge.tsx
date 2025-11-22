"use client";

import { Badge } from "@/components/ui/badge";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnnouncementsBadge() {
  const { data } = useSWR(
    "/api/announcements/unread-count",
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

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

