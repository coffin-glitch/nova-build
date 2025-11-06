"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Database,
    MessageSquare,
    Pause,
    Play,
    RefreshCw,
    Terminal,
    Wifi,
    WifiOff,
    XCircle
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success' | 'system';
  message: string;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export function TelegramForwarderConsole() {
  const [status, setStatus] = useState<TelegramForwarderStatus>({
    connected: false,
    forwarded_count: 0,
    parsed_count: 0,
    last_bid_at: null,
    last_error: null,
    uptime: '0s',
    status: 'stopped'
  });
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const statusPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logIdCounterRef = useRef(0);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (isExpanded) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  // Add log entry with unique ID
  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: 'numeric', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    const newLog: LogEntry = {
      id: `log-${++logIdCounterRef.current}`,
      timestamp,
      level,
      message
    };
    
    setLogs(prev => {
      const updated = [...prev, newLog];
      // Keep only last 200 logs
      return updated.slice(-200);
    });
  }, []);

  // Poll for status updates (primary mechanism)
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/telegram-forwarder', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status) {
          setStatus(prev => ({
            ...prev,
            status: data.status === 'running' ? 'running' : 'stopped',
            connected: data.status === 'running'
          }));
          
          if (data.status === 'running') {
            setConnectionState('connected');
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        
        if (errorData.status === 'offline' || errorData.status === 'timeout') {
          setConnectionState('error');
          setStatus(prev => ({
            ...prev,
            status: 'error',
            connected: false,
            last_error: errorData.message || errorData.error || 'Service unavailable'
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching status:', error);
      setConnectionState('error');
      setStatus(prev => ({
        ...prev,
        status: 'error',
        connected: false,
        last_error: 'Failed to connect to Railway service'
      }));
    }
  }, []);

  // Connect to SSE stream (secondary mechanism for real-time logs)
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;

    const connectSSE = () => {
      try {
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        setConnectionState('connecting');
        
        const eventSource = new EventSource('/api/telegram-forwarder/stream');
        eventSourceRef.current = eventSource;
        
        eventSource.onopen = () => {
          console.log('[Console] SSE connection opened');
          setConnectionState('connected');
          reconnectAttempts = 0;
          addLog('Connected to Railway service', 'success');
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle different message types
            if (data.type === 'status') {
              // Update status from Railway
              if (data.data) {
                setStatus(prev => ({
                  ...prev,
                  ...data.data,
                  status: data.data.status || prev.status,
                  connected: data.data.connected !== undefined ? data.data.connected : prev.connected
                }));
                
                if (data.data.status === 'running') {
                  setConnectionState('connected');
                }
              }
            } else if (data.type === 'log') {
              // Add log entry
              addLog(data.message, data.level || 'info');
            } else if (data.type === 'error') {
              // Handle error
              addLog(data.message, 'error');
              setConnectionState('error');
              setStatus(prev => ({
                ...prev,
                last_error: data.message,
                status: 'error'
              }));
            } else if (data.type === 'system') {
              // System messages
              addLog(data.message, data.level || 'info');
              
              if (data.level === 'success') {
                setConnectionState('connected');
              } else if (data.level === 'error') {
                setConnectionState('error');
              } else if (data.message.includes('Reconnecting')) {
                setConnectionState('reconnecting');
                const match = data.message.match(/(\d+)\/(\d+)/);
                if (match) {
                  setReconnectAttempts(parseInt(match[1]));
                }
              }
            }
          } catch (error) {
            console.error('[Console] Error parsing SSE message:', error);
            // Try to add as plain message
            if (event.data) {
              addLog(event.data, 'info');
            }
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('[Console] SSE connection error:', error);
          
          // EventSource will automatically try to reconnect
          // But we'll handle it manually for better control
          if (eventSource.readyState === EventSource.CLOSED) {
            setConnectionState('disconnected');
            reconnectAttempts++;
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              setConnectionState('reconnecting');
              addLog(`Connection lost. Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'warning');
              
              reconnectTimeout = setTimeout(() => {
                connectSSE();
              }, 3000);
            } else {
              setConnectionState('error');
              addLog('Max reconnection attempts reached. Please check Railway service.', 'error');
            }
          }
        };
        
      } catch (error) {
        console.error('[Console] Failed to connect to SSE:', error);
        setConnectionState('error');
        addLog('Failed to connect to Railway service', 'error');
        
        // Retry connection
        reconnectAttempts++;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeout = setTimeout(() => {
            connectSSE();
          }, 5000);
        }
      }
    };

    // Start SSE connection
    connectSSE();

    // Also start polling for status as backup
    fetchStatus(); // Initial fetch
    statusPollIntervalRef.current = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, [addLog, fetchStatus]);

  const handleStart = async () => {
    try {
      addLog('Starting telegram forwarder...', 'info');
      const response = await fetch('/api/telegram-forwarder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'start' })
      });
      
      if (response.ok) {
        addLog('Telegram forwarder started', 'success');
        await fetchStatus(); // Refresh status
      } else {
        const error = await response.json().catch(() => ({}));
        addLog(`Failed to start: ${error.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      addLog('Error starting telegram forwarder', 'error');
      console.error('Error starting:', error);
    }
  };

  const handleStop = async () => {
    try {
      addLog('Stopping telegram forwarder...', 'warning');
      const response = await fetch('/api/telegram-forwarder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'stop' })
      });
      
      if (response.ok) {
        addLog('Telegram forwarder stopped', 'warning');
        await fetchStatus(); // Refresh status
      } else {
        const error = await response.json().catch(() => ({}));
        addLog(`Failed to stop: ${error.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      addLog('Error stopping telegram forwarder', 'error');
      console.error('Error stopping:', error);
    }
  };

  const handleRestart = async () => {
    await handleStop();
    setTimeout(handleStart, 2000);
  };

  const getStatusColor = () => {
    if (status.status === 'running' && connectionState === 'connected') return 'text-green-400';
    if (status.status === 'error' || connectionState === 'error') return 'text-red-400';
    if (connectionState === 'reconnecting') return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getStatusIcon = () => {
    if (status.status === 'running' && connectionState === 'connected') {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    if (connectionState === 'connecting' || connectionState === 'reconnecting') {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (status.status === 'error' || connectionState === 'error') {
      return <XCircle className="w-4 h-4" />;
    }
    return <WifiOff className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (connectionState === 'connecting') return 'Connecting...';
    if (connectionState === 'reconnecting') return `Reconnecting... (${reconnectAttempts}/10)`;
    if (connectionState === 'error') return 'Error';
    if (status.status === 'running' && connectionState === 'connected') return 'Running';
    if (status.status === 'stopped') return 'Stopped';
    return 'Unknown';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            <span>Telegram Forwarder Console</span>
            <Badge 
              variant={status.status === 'running' && connectionState === 'connected' ? 'default' : 'secondary'}
              className={`text-xs ${getStatusColor()} flex items-center gap-1`}
            >
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 w-7 p-0"
            >
              {isExpanded ? '−' : '+'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {!isExpanded ? (
          // Compact view
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Forwarded:</span>
              <span className="font-mono font-semibold">{status.forwarded_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Parsed:</span>
              <span className="font-mono font-semibold">{status.parsed_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uptime:</span>
              <span className="font-mono font-semibold">{status.uptime}</span>
            </div>
          </div>
        ) : (
          // Expanded view
          <div className="space-y-4">
            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-xs text-muted-foreground">Forwarded</div>
                  <div className="font-mono font-semibold">{status.forwarded_count}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Database className="w-4 h-4 text-green-400" />
                <div>
                  <div className="text-xs text-muted-foreground">Parsed</div>
                  <div className="font-mono font-semibold">{status.parsed_count}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Clock className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                  <div className="font-mono font-semibold">{status.uptime}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Activity className="w-4 h-4 text-orange-400" />
                <div>
                  <div className="text-xs text-muted-foreground">Last Bid</div>
                  <div className="font-mono text-xs">
                    {status.last_bid_at ? new Date(status.last_bid_at).toLocaleTimeString() : 'Never'}
                  </div>
                </div>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
                disabled={status.status === 'running'}
                className="h-8"
              >
                <Play className="w-3 h-3 mr-1" />
                Start
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={status.status === 'stopped'}
                className="h-8"
              >
                <Pause className="w-3 h-3 mr-1" />
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                className="h-8"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Restart
              </Button>
            </div>

            {/* Connection Status */}
            <div className={`p-3 rounded border ${
              connectionState === 'connected' ? 'bg-green-900/20 border-green-500/30' :
              connectionState === 'error' ? 'bg-red-900/20 border-red-500/30' :
              connectionState === 'reconnecting' ? 'bg-yellow-900/20 border-yellow-500/30' :
              'bg-gray-900/20 border-gray-500/30'
            }`}>
              <div className="flex items-center gap-2 text-sm">
                {connectionState === 'connected' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                {connectionState === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {connectionState === 'reconnecting' && <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />}
                {connectionState === 'connecting' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                <span className={
                  connectionState === 'connected' ? 'text-green-400' :
                  connectionState === 'error' ? 'text-red-400' :
                  connectionState === 'reconnecting' ? 'text-yellow-400' :
                  'text-blue-400'
                }>
                  {connectionState === 'connected' && 'Connected to Railway service'}
                  {connectionState === 'connecting' && 'Connecting to Railway service...'}
                  {connectionState === 'reconnecting' && `Reconnecting... (${reconnectAttempts}/10)`}
                  {connectionState === 'error' && 'Connection error. Check Railway service.'}
                  {connectionState === 'disconnected' && 'Disconnected'}
                </span>
              </div>
              {status.last_error && (
                <div className="mt-2 text-xs text-red-400">
                  <strong>Error:</strong> {status.last_error}
                </div>
              )}
            </div>

            {/* Live Logs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Live Logs</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLogs([])}
                  className="h-6 text-xs"
                >
                  Clear
                </Button>
              </div>
              
              <ScrollArea className="h-64 w-full border rounded bg-black/50 font-mono">
                <div className="p-3 space-y-1">
                  {logs.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No logs yet. Waiting for connection...
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
                        <span className={`shrink-0 w-16 ${
                          log.level === 'success' ? 'text-green-400' :
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warning' ? 'text-yellow-400' :
                          log.level === 'system' ? 'text-blue-400' :
                          'text-gray-300'
                        }`}>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className={`flex-1 ${
                          log.level === 'success' ? 'text-green-300' :
                          log.level === 'error' ? 'text-red-300' :
                          log.level === 'warning' ? 'text-yellow-300' :
                          log.level === 'system' ? 'text-blue-300' :
                          'text-gray-200'
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
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
