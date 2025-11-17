"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useUnifiedRole";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const isAdmin = useIsAdmin();
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 100, y: 100 }); // Safe default for SSR
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);

  // Set initial position on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 200, y: window.innerHeight - 150 });
    }
  }, []);

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
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 64; // 64px for button width
      const maxY = window.innerHeight - 64; // 64px for button height
      
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

  // Load conversation history when opening or when conversationId changes
  useEffect(() => {
    if (isOpen && conversationId) {
      loadConversation(conversationId);
    }
  }, [isOpen, conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleButtonClick = () => {
    const clickDuration = Date.now() - dragStartTime;
    // Only open if it was a quick click (not a drag)
    if (clickDuration < 200) {
      setIsOpen(true);
      // If no conversationId, start fresh (will create new conversation on first message)
      if (!conversationId) {
        setMessages([{
          role: "assistant",
          content: "Hello! I'm your AI analytics assistant. I can help you analyze bid data, carrier performance, and auction insights. What would you like to know?",
          timestamp: new Date(),
        }]);
        conversationHistory.current = [];
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
          // Don't send conversationHistory - let API load from DB
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();
      
      // Update conversationId if this is a new conversation
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
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
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please make sure OPENAI_API_KEY is set in your environment variables.",
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

  // Don't render if not admin
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
            {/* Subtle floating animation rings */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 opacity-10 animate-ping scale-110"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-indigo-700 opacity-8 animate-pulse scale-105"></div>
            
            <Button
              onClick={handleButtonClick}
              className={cn(
                "floating-admin-button relative h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 bg-gradient-to-br from-purple-600/80 via-indigo-600/80 to-purple-800/80 hover:from-purple-500/90 hover:via-indigo-500/90 hover:to-purple-700/90 border border-purple-400/30 hover:border-purple-300/50 backdrop-blur-md p-0 min-w-[3rem] min-h-[3rem] max-w-[3rem] max-h-[3rem]",
                "cursor-move select-none",
                isDragging && "scale-105 cursor-grabbing",
                isOpen && "scale-0 opacity-0"
              )}
              style={{ userSelect: 'none' }}
            >
              <Bot className="h-5 w-5 text-white drop-shadow-sm" />
            </Button>
          </div>
        </div>
      </div>

      {/* AI Chat Console */}
      {isOpen && (
        <div 
          className="fixed z-50 w-96 h-[600px] flex flex-col"
          style={{ left: position.x, top: position.y + 70 }}
          ref={chatRef}
        >
          <Card className="card-premium flex flex-col h-full shadow-2xl border border-purple-400/20 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-purple-400/20 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-300" />
                <h3 className="font-semibold text-purple-100">AI Analytics Assistant</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0 hover:bg-purple-500/20"
              >
                <X className="w-4 h-4 text-purple-300" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-slate-900/50" ref={scrollAreaRef}>
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
                        "max-w-[80%] rounded-lg p-3 backdrop-blur-sm",
                        message.role === "user"
                          ? "bg-gradient-to-br from-purple-600/80 to-indigo-600/80 text-white border border-purple-400/30"
                          : "bg-slate-800/60 text-slate-100 border border-slate-700/50"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50 backdrop-blur-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-purple-400/20 bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-sm">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about bids, carriers, analytics..."
                  disabled={isLoading}
                  className="flex-1 bg-slate-800/60 border-slate-700/50 text-slate-100 placeholder:text-slate-400 backdrop-blur-sm"
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="bg-gradient-to-br from-purple-600/80 to-indigo-600/80 hover:from-purple-500/90 hover:to-indigo-500/90 border border-purple-400/30"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Try: "What's our win rate this week?" or "Show me today's bid statistics"
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

