"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle, XCircle, Clock } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DbHealth() {
  const { data, error, isLoading } = useSWR("/api/health/db", fetcher, {
    refreshInterval: 10000, // Poll every 10 seconds
    revalidateOnFocus: true,
  });

  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  useEffect(() => {
    setLastChecked(new Date());
  }, [data, error]);

  if (isLoading) {
    return (
      <Card className="fixed bottom-4 right-4 p-3 bg-background/95 backdrop-blur-sm border shadow-lg z-50">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground animate-spin" />
          <span className="text-sm text-muted-foreground">Checking DB...</span>
        </div>
      </Card>
    );
  }

  const isHealthy = data?.ok === true;
  const errorMessage = error?.message || data?.error;

  return (
    <Card className="fixed bottom-4 right-4 p-3 bg-background/95 backdrop-blur-sm border shadow-lg z-50">
      <div className="flex items-center gap-2">
        {isHealthy ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3" />
            <Badge variant={isHealthy ? "default" : "destructive"} className="text-xs">
              {isHealthy ? "DB OK" : "DB Error"}
            </Badge>
          </div>
          {errorMessage && (
            <span className="text-xs text-muted-foreground max-w-48 truncate">
              {errorMessage}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {lastChecked.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </Card>
  );
}
