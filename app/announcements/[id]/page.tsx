"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, ArrowLeft, Info, Megaphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const priorityConfig = {
  urgent: {
    color: 'destructive',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-900/50',
    icon: AlertCircle,
    label: 'Urgent',
  },
  high: {
    color: 'default',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-900/50',
    icon: AlertTriangle,
    label: 'High',
  },
  normal: {
    color: 'default',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-900/50',
    icon: Megaphone,
    label: 'Normal',
  },
  low: {
    color: 'secondary',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    borderColor: 'border-gray-200 dark:border-gray-900/50',
    icon: Info,
    label: 'Low',
  },
};

export default function AnnouncementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const announcementId = params.id as string;
  const [markingRead, setMarkingRead] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/announcements/${announcementId}`,
    fetcher
  );

  const announcement = data?.data;

  // Mark as read when page loads (if not already read)
  useEffect(() => {
    if (announcement && !announcement.is_read && !markingRead) {
      markAsRead();
    }
  }, [announcement]);

  const markAsRead = async () => {
    if (markingRead) return;
    
    setMarkingRead(true);
    try {
      await fetch(`/api/announcements/${announcementId}/read`, {
        method: 'POST',
      });
      mutate(); // Refresh data
    } catch (error) {
      console.error('Failed to mark as read:', error);
    } finally {
      setMarkingRead(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load announcement</p>
          <Button onClick={() => router.push('/announcements')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Announcements
          </Button>
        </div>
      </div>
    );
  }

  const config = priorityConfig[announcement.priority as keyof typeof priorityConfig] || priorityConfig.normal;
  const Icon = config.icon;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => router.push('/announcements')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Announcements
      </Button>

      <Card className={`${config.bgColor} ${config.borderColor} border-2`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={`
                p-3 rounded-lg
                ${announcement.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30' : ''}
                ${announcement.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' : ''}
                ${announcement.priority === 'normal' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                ${announcement.priority === 'low' ? 'bg-gray-100 dark:bg-gray-900/30' : ''}
                flex-shrink-0
              `}>
                <Icon className={`
                  w-6 h-6
                  ${announcement.priority === 'urgent' ? 'text-red-600 dark:text-red-400' : ''}
                  ${announcement.priority === 'high' ? 'text-orange-600 dark:text-orange-400' : ''}
                  ${announcement.priority === 'normal' ? 'text-blue-600 dark:text-blue-400' : ''}
                  ${announcement.priority === 'low' ? 'text-gray-600 dark:text-gray-400' : ''}
                `} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">{announcement.title}</h1>
                  <Badge variant={config.color as any}>
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                  </span>
                  {announcement.is_read && (
                    <span className="text-green-600 dark:text-green-400">✓ Read</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {announcement.message}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

