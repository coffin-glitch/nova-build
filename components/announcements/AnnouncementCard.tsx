"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, AlertTriangle, Info, Megaphone } from "lucide-react";
import Link from "next/link";

interface AnnouncementCardProps {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  isRead?: boolean;
  expiresAt?: string | null;
  showFullMessage?: boolean;
}

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

export default function AnnouncementCard({
  id,
  title,
  message,
  priority,
  createdAt,
  isRead = false,
  expiresAt,
  showFullMessage = false,
}: AnnouncementCardProps) {
  const config = priorityConfig[priority] || priorityConfig.normal;
  const Icon = config.icon;
  const displayMessage = showFullMessage ? message : (message.length > 150 ? message.substring(0, 150) + '...' : message);

  return (
    <Link href={`/announcements/${id}`}>
      <Card className={`
        ${config.bgColor} ${config.borderColor}
        border-2 transition-all duration-200
        hover:shadow-lg hover:scale-[1.02]
        ${!isRead ? 'ring-2 ring-primary/20' : ''}
        cursor-pointer
      `}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`
                p-2 rounded-lg
                ${priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30' : ''}
                ${priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' : ''}
                ${priority === 'normal' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                ${priority === 'low' ? 'bg-gray-100 dark:bg-gray-900/30' : ''}
                flex-shrink-0
              `}>
                <Icon className={`
                  w-5 h-5
                  ${priority === 'urgent' ? 'text-red-600 dark:text-red-400' : ''}
                  ${priority === 'high' ? 'text-orange-600 dark:text-orange-400' : ''}
                  ${priority === 'normal' ? 'text-blue-600 dark:text-blue-400' : ''}
                  ${priority === 'low' ? 'text-gray-600 dark:text-gray-400' : ''}
                `} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg leading-tight">{title}</h3>
                  {!isRead && (
                    <Badge variant="default" className="text-xs">
                      New
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={config.color as any} className="text-xs">
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {displayMessage}
          </p>
          {!showFullMessage && message.length > 150 && (
            <p className="text-xs text-primary mt-2 font-medium">
              Read more →
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

