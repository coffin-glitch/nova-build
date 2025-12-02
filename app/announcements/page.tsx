"use client";

import AnnouncementCard from "@/components/announcements/AnnouncementCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useRealtimeAnnouncementReads } from "@/hooks/useRealtimeAnnouncementReads";
import { useRealtimeAnnouncements } from "@/hooks/useRealtimeAnnouncements";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { Filter, Search } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnnouncementsPage() {
  const { accentColor, accentColorStyle, accentBgStyle } = useAccentColor();
  const { user } = useUnifiedUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/announcements?include_read=${activeTab === 'all' ? 'true' : 'false'}${priorityFilter ? `&priority=${priorityFilter}` : ''}`,
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

  const announcements = data?.data || [];
  const unreadCount = data?.unreadCount || 0;

  // Filter announcements by search query
  const filteredAnnouncements = announcements.filter((announcement: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      announcement.title.toLowerCase().includes(query) ||
      announcement.message.toLowerCase().includes(query)
    );
  });

  // Group by priority for sorting
  const sortedAnnouncements = [...filteredAnnouncements].sort((a, b) => {
    const priorityOrder = { urgent: 1, high: 2, normal: 3, low: 4 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If same priority, sort by date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-destructive">Failed to load announcements</p>
          <Button onClick={() => mutate()} className="mt-4" style={accentBgStyle}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Announcements</h1>
        <p className="text-muted-foreground">
          Stay updated with the latest news and updates from NOVA
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={accentColorStyle} />
          <Input
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4" style={accentColorStyle} />
          <span className="text-sm text-muted-foreground">Priority:</span>
          <Button
            variant={priorityFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setPriorityFilter(null)}
            style={priorityFilter === null ? accentBgStyle : { borderColor: accentColor }}
          >
            All
          </Button>
          <Button
            variant={priorityFilter === "urgent" ? "default" : "outline"}
            size="sm"
            onClick={() => setPriorityFilter(priorityFilter === "urgent" ? null : "urgent")}
            style={priorityFilter === "urgent" ? accentBgStyle : { borderColor: accentColor }}
          >
            Urgent
          </Button>
          <Button
            variant={priorityFilter === "high" ? "default" : "outline"}
            size="sm"
            onClick={() => setPriorityFilter(priorityFilter === "high" ? null : "high")}
            style={priorityFilter === "high" ? accentBgStyle : { borderColor: accentColor }}
          >
            High
          </Button>
          <Button
            variant={priorityFilter === "normal" ? "default" : "outline"}
            size="sm"
            onClick={() => setPriorityFilter(priorityFilter === "normal" ? null : "normal")}
            style={priorityFilter === "normal" ? accentBgStyle : { borderColor: accentColor }}
          >
            Normal
          </Button>
          <Button
            variant={priorityFilter === "low" ? "default" : "outline"}
            size="sm"
            onClick={() => setPriorityFilter(priorityFilter === "low" ? null : "low")}
            style={priorityFilter === "low" ? accentBgStyle : { borderColor: accentColor }}
          >
            Low
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">
            All
            {announcements.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {announcements.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Announcements List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : sortedAnnouncements.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery
              ? "No announcements match your search"
              : activeTab === "unread"
              ? "No unread announcements"
              : "No announcements yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedAnnouncements.map((announcement: any) => (
            <AnnouncementCard
              key={announcement.id}
              id={announcement.id}
              title={announcement.title}
              message={announcement.message}
              priority={announcement.priority}
              createdAt={announcement.created_at}
              isRead={announcement.is_read}
              expiresAt={announcement.expires_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}

