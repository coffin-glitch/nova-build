"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnnouncementsNavLink() {
  const { data } = useSWR(
    "/api/announcements/unread-count",
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

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

