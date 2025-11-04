"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Activity,
    Clock,
    Database,
    MessageSquare,
    Pause,
    Play,
    RefreshCw,
    Terminal,
    Wifi,
    WifiOff
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TelegramForwarderStatus {
  connected: boolean;
  forwarded_count: number;
  parsed_count: number;
  last_bid_at: string | null;
  last_error: string | null;
  uptime: string;
  status: 'running' | 'stopped' | 'error';
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  color: string;
}

export function TelegramForwarderConsole() {
  const [status, setStatus] = useState<TelegramForwarderStatus>({
    connected: true,
    forwarded_count: 4871,
    parsed_count: 4868,
    last_bid_at: '2025-10-25T23:57:05.982Z',
    last_error: null,
    uptime: '2m',
    status: 'running'
  });
  
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      timestamp: '11:17:00 PM',
      level: 'success',
      message: 'Telegram forwarder started successfully',
      color: 'text-green-400'
    },
    {
      timestamp: '11:17:05 PM',
      level: 'info',
      message: 'Connected to Supabase database',
      color: 'text-blue-400'
    },
    {
      timestamp: '11:17:10 PM',
      level: 'info',
      message: 'Monitoring Telegram channel for new bids',
      color: 'text-blue-400'
    }
  ]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Connect to Railway service via Server-Sent Events (SSE)
  // This proxies the WebSocket connection from Railway through Next.js
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        // Use the SSE endpoint which proxies to Railway
        eventSource = new EventSource('/api/telegram-forwarder/stream');
        
        eventSource.onopen = () => {
          console.log('Connected to telegram forwarder stream');
          addLog('Connected to Railway telegram forwarder service', 'success');
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'status') {
              setStatus(prev => ({ ...prev, ...data.data }));
            } else if (data.type === 'log') {
              addLog(data.message, data.level || 'info');
            } else if (data.type === 'error') {
              addLog(data.message, 'error');
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
            // Try to parse as plain message
            if (event.data) {
              addLog(event.data, 'info');
            }
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          addLog('Connection error. Reconnecting...', 'warning');
          
          // Close and reconnect
          if (eventSource) {
            eventSource.close();
          }
          
          setTimeout(() => {
            connectSSE();
          }, 5000);
        };
        
      } catch (error) {
        console.error('Failed to connect to SSE:', error);
        addLog('Failed to connect to telegram forwarder service', 'error');
        
        // Retry connection
        setTimeout(() => {
          connectSSE();
        }, 5000);
      }
    };

    connectSSE();
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Poll for status updates every 5 seconds as a fallback
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/telegram-forwarder');
        if (response.ok) {
          const data = await response.json();
          if (data.status) {
            setStatus(prev => ({
              ...prev,
              ...data,
              status: data.status === 'running' ? 'running' : 'stopped',
              connected: data.status === 'running'
            }));
          }
        } else {
          // Handle error responses
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error) {
            setStatus(prev => ({
              ...prev,
              status: 'error',
              connected: false,
              last_error: errorData.message || errorData.error
            }));
            
            // Log the error
            if (errorData.status === 'offline' || errorData.status === 'timeout') {
              addLog(`Railway service unavailable: ${errorData.message}`, 'error');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching status:', error);
        setStatus(prev => ({
          ...prev,
          status: 'error',
          connected: false,
          last_error: 'Failed to connect to Railway service'
        }));
      }
    };

    // Fetch initial status
    fetchStatus();

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: 'text-blue-400',
      warning: 'text-yellow-400',
      error: 'text-red-400',
      success: 'text-green-400'
    };
    
    setLogs(prev => [...prev.slice(-99), {
      timestamp,
      level,
      message,
      color: colors[level]
    }]);
  };

  const handleStart = async () => {
    try {
      const response = await fetch('/api/telegram-forwarder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'start' })
      });
      
      if (response.ok) {
        setIsRunning(true);
        addLog('Starting telegram forwarder...', 'info');
      } else {
        addLog('Failed to start telegram forwarder', 'error');
      }
    } catch (error) {
      addLog('Error starting telegram forwarder', 'error');
    }
  };

  const handleStop = async () => {
    try {
      const response = await fetch('/api/telegram-forwarder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'stop' })
      });
      
      if (response.ok) {
        setIsRunning(false);
        addLog('Stopping telegram forwarder...', 'warning');
      } else {
        addLog('Failed to stop telegram forwarder', 'error');
      }
    } catch (error) {
      addLog('Error stopping telegram forwarder', 'error');
    }
  };

  const handleRestart = async () => {
    await handleStop();
    setTimeout(handleStart, 2000);
  };

  const getStatusColor = () => {
    if (status.status === 'running' && status.connected) return 'text-green-400';
    if (status.status === 'error') return 'text-red-400';
    return 'text-yellow-400';
  };

  const getStatusIcon = () => {
    if (status.status === 'running' && status.connected) return <Wifi className="w-4 h-4" />;
    if (status.status === 'error') return <WifiOff className="w-4 h-4" />;
    return <WifiOff className="w-4 h-4" />;
  };

  return (
    <Card className={`fixed bottom-4 right-4 w-96 transition-all duration-300 ${
      isExpanded ? 'h-[600px]' : 'h-32'
    }`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span>Telegram Forwarder</span>
            <Badge 
              variant={status.status === 'running' ? 'default' : 'secondary'}
              className={`text-xs ${getStatusColor()}`}
            >
              {getStatusIcon()}
              {status.status === 'running' ? 'Running' : 'Stopped'}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? '−' : '+'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {!isExpanded ? (
          // Compact view
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Forwarded:</span>
              <span className="font-mono">{status.forwarded_count}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Parsed:</span>
              <span className="font-mono">{status.parsed_count}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Uptime:</span>
              <span className="font-mono">{status.uptime}</span>
            </div>
          </div>
        ) : (
          // Expanded view
          <div className="space-y-4">
            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-blue-400" />
                <span className="text-muted-foreground">Forwarded:</span>
                <span className="font-mono">{status.forwarded_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-green-400" />
                <span className="text-muted-foreground">Parsed:</span>
                <span className="font-mono">{status.parsed_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-purple-400" />
                <span className="text-muted-foreground">Uptime:</span>
                <span className="font-mono">{status.uptime}</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-orange-400" />
                <span className="text-muted-foreground">Last Bid:</span>
                <span className="font-mono">
                  {status.last_bid_at ? new Date(status.last_bid_at).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
                disabled={isRunning}
                className="h-7"
              >
                <Play className="w-3 h-3 mr-1" />
                Start
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={!isRunning}
                className="h-7"
              >
                <Pause className="w-3 h-3 mr-1" />
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                className="h-7"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Restart
              </Button>
            </div>

            {/* Error Display */}
            {status.last_error && (
              <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400 space-y-2">
                <div>
                  <strong>Error:</strong> {status.last_error}
                </div>
                {status.last_error.includes('502') || status.last_error.includes('connection refused') ? (
                  <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
                    <strong className="text-yellow-400">⚠️ Service Not Running</strong>
                    <p className="text-yellow-300 mt-1">
                      The Railway service appears to be down. Check Railway dashboard logs for details.
                    </p>
                    <a 
                      href="https://railway.app" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline mt-1 inline-block"
                    >
                      → Open Railway Dashboard
                    </a>
                  </div>
                ) : null}
              </div>
            )}

            {/* Live Logs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Live Logs</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLogs([])}
                  className="h-6 text-xs"
                >
                  Clear
                </Button>
              </div>
              
              <ScrollArea className="h-48 w-full border rounded bg-black/50">
                <div className="p-2 space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs font-mono">
                      <span className="text-muted-foreground">{log.timestamp}</span>
                      <span className={`${log.color} flex-1`}>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
