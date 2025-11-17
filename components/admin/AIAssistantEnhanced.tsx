"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, X, Plus, MessageSquare, Folder, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useUnifiedRole";
import { useAccentColor } from "@/hooks/useAccentColor";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  folder_name?: string;
  is_pinned?: boolean;
  first_message?: string;
}

export default function AIAssistantEnhanced() {
  const isAdmin = useIsAdmin();
  const { accentColor } = useAccentColor();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI analytics assistant. I can help you analyze bid data, carrier performance, and auction insights. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);

  // Set initial position on client side - only after mount
  useEffect(() => {
    setPosition({ x: window.innerWidth - 200, y: window.innerHeight - 150 });
  }, []);

  // Load conversations when opening
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  // Load conversation history when conversationId changes
  useEffect(() => {
    if (isOpen && conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStartTime(Date.now());
    const rect = buttonRef.current!.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      e.preventDefault();
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      const maxX = window.innerWidth - 64;
      const maxY = window.innerHeight - 64;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);


  const loadConversations = async () => {
    try {
      const response = await fetch("/api/admin/ai-assistant");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const loadConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/admin/ai-assistant?conversation_id=${convId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.conversation && data.conversation.messages) {
          const loadedMessages: Message[] = data.conversation.messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at),
          }));
          setMessages(loadedMessages);
          conversationHistory.current = loadedMessages.map(m => ({
            role: m.role,
            content: m.content,
          }));
        }
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([{
      role: "assistant",
      content: "Hello! I'm your AI analytics assistant. I can help you analyze bid data, carrier performance, and auction insights. What would you like to know?",
      timestamp: new Date(),
    }]);
    conversationHistory.current = [];
    setShowConversations(false);
  };

  const handleButtonClick = () => {
    const clickDuration = Date.now() - dragStartTime;
    if (clickDuration < 200) {
      setIsOpen(true);
      if (!conversationId) {
        startNewConversation();
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    conversationHistory.current.push({ role: "user", content: input.trim() });
    const currentInput = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentInput,
          conversationId: conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to get AI response`);
      }

      const data = await response.json();
      
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
        loadConversations(); // Refresh conversation list
      }
      
      const assistantMessage: Message = {
        role: "assistant",
        content: data.response || "I'm sorry, I couldn't generate a response.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      conversationHistory.current.push({ role: "assistant", content: assistantMessage.content });
    } catch (error) {
      console.error("Error sending message:", error);
      const errorDetails = error instanceof Error ? error.message : "Unknown error";
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorDetails}\n\nPlease check:\n- OPENAI_API_KEY is set in .env.local\n- Server has been restarted after adding the key\n- Database migration 112 has been run (for memory features)`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectConversation = (convId: string) => {
    setConversationId(convId);
    setShowConversations(false);
  };

  // Helper function to convert HSL to RGB for opacity calculations
  const hslToRgba = (hsl: string, opacity: number = 1): string => {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return `rgba(99, 102, 241, ${opacity})`; // Default blue fallback
    
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;
    
    let r = 0, g = 0, b = 0;
    
    if (h < 1/6) { r = c; g = x; b = 0; }
    else if (h < 2/6) { r = x; g = c; b = 0; }
    else if (h < 3/6) { r = 0; g = c; b = x; }
    else if (h < 4/6) { r = 0; g = x; b = c; }
    else if (h < 5/6) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    return `rgba(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}, ${opacity})`;
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {/* Floating AI Assistant Button */}
      <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
        <div
          ref={buttonRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "relative cursor-move select-none",
            isDragging && "cursor-grabbing"
          )}
        >
          <div className="relative">
            <Button
              onClick={handleButtonClick}
              className={cn(
                "floating-admin-button relative h-12 w-12 rounded-full transition-all duration-300 hover:scale-105",
                // Black glossy sleek design
                "bg-gradient-to-br from-gray-900 via-black to-gray-800",
                "backdrop-blur-2xl",
                // Glossy shine effect
                "before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-br before:from-white/20 before:via-transparent before:to-transparent before:opacity-60",
                // Sleek border
                "border-2 border-gray-700/50 hover:border-gray-600/60",
                "shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_4px_20px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.05)]",
                "hover:shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_6px_30px_rgba(0,0,0,0.7),inset_0_0_30px_rgba(255,255,255,0.08)]",
                "p-0 min-w-[3rem] min-h-[3rem] max-w-[3rem] max-h-[3rem]",
                "cursor-move select-none overflow-hidden",
                isDragging && "scale-105 cursor-grabbing",
                isOpen && "scale-0 opacity-0"
              )}
              style={{ userSelect: 'none' }}
            >
              <Bot className="h-5 w-5 text-white/95 drop-shadow-lg relative z-10" />
            </Button>
          </div>
        </div>
      </div>

      {/* AI Chat Console */}
      {isOpen && (
        <div 
          className="fixed z-50 flex"
          style={{ left: position.x, top: position.y + 70 }}
          ref={chatRef}
        >
          {/* Conversation Sidebar */}
          {showConversations && (
            <Card className={cn("w-64 mr-2 border-2 border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl rounded-2xl overflow-hidden relative shadow-2xl")}>
              {/* Glossy overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-2xl"></div>
              {/* Accent color glow */}
              <div 
                className="absolute -inset-1 bg-gradient-to-br rounded-2xl blur-xl -z-10"
                style={{
                  background: `linear-gradient(to bottom right, ${hslToRgba(accentColor, 0.2)}, ${hslToRgba(accentColor, 0.1)}, ${hslToRgba(accentColor, 0.2)})`
                }}
              ></div>
              
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white/90">Conversations</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConversations(false)}
                    className="h-6 w-6 p-0 hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-3 h-3 text-white/80" />
                  </Button>
                </div>
                <Button
                  onClick={startNewConversation}
                  className="w-full bg-gradient-to-br rounded-xl backdrop-blur-xl text-white border shadow-lg"
                  style={{
                    background: `linear-gradient(to bottom right, ${hslToRgba(accentColor, 0.4)}, ${hslToRgba(accentColor, 0.3)})`,
                    borderColor: hslToRgba(accentColor, 0.3),
                    boxShadow: `0 10px 15px -3px ${hslToRgba(accentColor, 0.2)}, 0 4px 6px -2px ${hslToRgba(accentColor, 0.1)}`
                  }}
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
              </div>
              <ScrollArea className="h-[500px] relative z-10">
                <div className="p-2 space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                        className={cn(
                        "w-full text-left p-2 rounded-xl hover:bg-white/10 transition-all backdrop-blur-sm border border-transparent hover:border-white/10",
                        conversationId === conv.id && "bg-white/15 shadow-lg"
                      )}
                      style={conversationId === conv.id ? {
                        borderColor: hslToRgba(accentColor, 0.3)
                      } : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-white/70" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 truncate">
                            {conv.title || conv.first_message?.substring(0, 30) || "New Conversation"}
                          </p>
                          <p className="text-xs text-white/50">
                            {new Date(conv.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Main Chat Window */}
          <Card className="card-premium flex flex-col w-96 h-[600px] shadow-2xl border-2 border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl rounded-2xl overflow-hidden relative">
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-2xl"></div>
            {/* Accent color glow */}
            <div 
              className="absolute -inset-1 bg-gradient-to-br rounded-2xl blur-xl -z-10"
              style={{
                background: `linear-gradient(to bottom right, ${hslToRgba(accentColor, 0.2)}, ${hslToRgba(accentColor, 0.1)}, ${hslToRgba(accentColor, 0.2)})`
              }}
            ></div>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent backdrop-blur-sm relative z-10">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConversations(!showConversations)}
                  className="h-8 w-8 p-0 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-white/80" />
                </Button>
                <Bot className="w-5 h-5 text-white/90" />
                <h3 className="font-semibold text-white/90">AI Assistant</h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startNewConversation}
                  className="h-8 w-8 p-0 hover:bg-white/10 rounded-lg transition-colors"
                  title="New Chat"
                >
                  <Plus className="w-4 h-4 text-white/80" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/80" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-transparent to-white/5 relative z-10" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-xl p-3 backdrop-blur-xl border",
                        message.role === "user"
                          ? "bg-gradient-to-br text-white shadow-lg"
                          : "bg-white/90 text-black border-white/20 shadow-lg"
                      )}
                      style={message.role === "user" ? {
                        background: `linear-gradient(to bottom right, ${hslToRgba(accentColor, 0.3)}, ${hslToRgba(accentColor, 0.2)}, ${hslToRgba(accentColor, 0.3)})`,
                        borderColor: hslToRgba(accentColor, 0.3),
                        boxShadow: `0 10px 15px -3px ${hslToRgba(accentColor, 0.2)}, 0 4px 6px -2px ${hslToRgba(accentColor, 0.1)}`
                      } : undefined}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <p className={cn("text-xs mt-2", message.role === "user" ? "opacity-60" : "text-gray-600")}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-xl p-3 border border-white/20 backdrop-blur-xl shadow-lg">
                      <Loader2 
                        className="w-4 h-4 animate-spin" 
                        style={{ color: accentColor }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-white/10 bg-gradient-to-r from-white/5 to-transparent backdrop-blur-sm relative z-10">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about bids, carriers, analytics..."
                  disabled={isLoading}
                  className="flex-1 bg-white/90 border-white/20 text-black placeholder:text-gray-500 backdrop-blur-xl rounded-xl focus:ring-2 transition-all"
                  style={{
                    '--tw-ring-color': hslToRgba(accentColor, 0.2),
                  } as React.CSSProperties & { '--tw-ring-color': string }}
                  onFocus={(e) => {
                    e.target.style.borderColor = hslToRgba(accentColor, 0.4);
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="bg-gradient-to-br rounded-xl backdrop-blur-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all border shadow-lg"
                  style={{
                    background: `linear-gradient(to bottom right, ${hslToRgba(accentColor, 0.4)}, ${hslToRgba(accentColor, 0.3)})`,
                    borderColor: hslToRgba(accentColor, 0.3),
                    boxShadow: `0 10px 15px -3px ${hslToRgba(accentColor, 0.2)}, 0 4px 6px -2px ${hslToRgba(accentColor, 0.1)}`
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-white/50 mt-2">
                Try: "What's our win rate this week?" or "Show me today's bid statistics"
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

