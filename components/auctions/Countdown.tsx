"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  endsAt: string; // ISO string
  onExpire?: () => void;
  className?: string;
}

export default function Countdown({ endsAt, onExpire, className }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    const now = new Date().getTime();
    const endTime = new Date(endsAt).getTime();
    const difference = endTime - now;

    if (difference <= 0) {
      setIsExpired(true);
      setTimeLeft(0);
      onExpire?.();
      return 0;
    }

    setTimeLeft(difference);
    setIsExpired(false);
    return difference;
  }, [endsAt, onExpire]);

  useEffect(() => {
    // Calculate initial time left
    calculateTimeLeft();

    // Set up interval to update every second
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeLeft]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    const totalDuration = 25 * 60 * 1000; // 25 minutes in milliseconds
    const remaining = Math.max(0, timeLeft);
    return (remaining / totalDuration) * 100;
  };

  const getUrgencyColor = () => {
    const totalSeconds = Math.floor(timeLeft / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    
    if (isExpired) return "text-red-500";
    if (minutes < 2) return "text-red-500";
    if (minutes < 5) return "text-amber-500";
    return "text-green-500";
  };

  const getProgressColor = () => {
    const totalSeconds = Math.floor(timeLeft / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    
    if (isExpired) return "from-red-500 to-red-600";
    if (minutes < 2) return "from-red-500 to-red-600";
    if (minutes < 5) return "from-amber-500 to-amber-600";
    return "from-green-500 to-green-600";
  };

  if (isExpired) {
    return (
      <div className={cn("text-center", className)}>
        <div className="text-sm font-medium text-red-500 mb-1">Expired</div>
        <div className="w-full bg-red-100 dark:bg-red-900/20 rounded-full h-2">
          <div className="bg-red-500 h-2 rounded-full w-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("text-center", className)}>
      <div className={cn("text-lg font-bold mb-2", getUrgencyColor())}>
        {formatTime(timeLeft)}
      </div>
      <div className="text-xs text-muted-foreground mb-2">remaining</div>
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className={cn(
            "h-2 rounded-full transition-all duration-1000 ease-out",
            `bg-gradient-to-r ${getProgressColor()}`
          )}
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
    </div>
  );
}
