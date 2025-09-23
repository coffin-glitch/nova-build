"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle, XCircle } from "lucide-react";

interface CountdownProps {
  expiresAt: string | Date;
  variant?: "default" | "urgent" | "expired";
  className?: string;
}

export function Countdown({ expiresAt, variant = "default", className = "" }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  }>({ hours: 0, minutes: 0, seconds: 0, total: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const difference = Math.max(0, expiry - now);

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, total: difference });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = timeLeft.total === 0;
  const isUrgent = timeLeft.total > 0 && timeLeft.total <= 300000; // 5 minutes

  const getVariantStyles = () => {
    if (isExpired) {
      return "text-red-400 bg-red-500/20 border-red-400/30";
    }
    if (isUrgent) {
      return "text-yellow-400 bg-yellow-500/20 border-yellow-400/30";
    }
    return "text-green-400 bg-green-500/20 border-green-400/30";
  };

  const getIcon = () => {
    if (isExpired) {
      return <XCircle className="w-4 h-4" />;
    }
    if (isUrgent) {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };

  const formatTime = () => {
    if (isExpired) {
      return "Expired";
    }
    
    if (timeLeft.hours > 0) {
      return `${timeLeft.hours}h ${timeLeft.minutes}m`;
    }
    
    if (timeLeft.minutes > 0) {
      return `${timeLeft.minutes}m ${timeLeft.seconds}s`;
    }
    
    return `${timeLeft.seconds}s`;
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getVariantStyles()} ${className}`}>
      {getIcon()}
      <span>{formatTime()}</span>
    </div>
  );
}