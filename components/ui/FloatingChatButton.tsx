"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  isAdmin: boolean;
}

export default function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "Admin",
      message: "Welcome to NOVA Build! How can we help you today?",
      timestamp: new Date(),
      isAdmin: true,
    },
  ]);
  
  const buttonRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const sendMessage = () => {
    if (!message.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "You",
      message: message.trim(),
      timestamp: new Date(),
      isAdmin: false,
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessage("");
    
    // Simulate admin response
    setTimeout(() => {
      const adminResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "Admin",
        message: "Thank you for your message. We'll get back to you shortly!",
        timestamp: new Date(),
        isAdmin: true,
      };
      setMessages(prev => [...prev, adminResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
      {/* Floating N Button */}
      <div
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        className={cn(
          "relative cursor-move select-none",
          isDragging && "cursor-grabbing"
        )}
      >
        <Button
          onClick={(e) => {
            const dragDuration = Date.now() - dragStartTime;
            if (!isDragging && dragDuration > 100) {
              setIsOpen(!isOpen);
            }
          }}
          className={cn(
            "h-16 w-16 rounded-full p-0 transition-all duration-200 ease-out",
            "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600",
            "hover:from-slate-500 hover:via-slate-600 hover:to-slate-700",
            "shadow-2xl hover:shadow-3xl hover:scale-110",
            "border-2 border-slate-300/50 backdrop-blur-sm",
            "text-white font-bold text-2xl",
            "cursor-move select-none",
            isDragging && "scale-105 cursor-grabbing",
            isOpen && "scale-0 opacity-0"
          )}
          style={{ userSelect: 'none' }}
        >
          N
        </Button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Chat Bubble */}
          <div 
            className="fixed z-50 animate-in slide-in-from-bottom-4 duration-500 ease-out"
            style={{
              left: Math.min(position.x, window.innerWidth - 320), // 320px for chat width
              top: Math.min(position.y - 400, window.innerHeight - 400), // 400px for chat height
            }}
          >
            {/* Bubble Tail */}
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-gradient-to-br from-slate-400 to-slate-600 rotate-45 border-r border-b border-slate-300/50"></div>
            
            {/* Main Chat Window */}
            <div className="relative bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300/50 dark:border-slate-600/50 backdrop-blur-lg overflow-hidden w-80 h-96 flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-500/10 to-slate-600/5 dark:from-slate-700/30 dark:to-slate-800/30 border-b border-slate-300/20 dark:border-slate-600/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-500/20 dark:bg-slate-600/30 rounded-full">
                    <MessageCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">NOVA Chat</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Connect with admins</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.isAdmin ? "items-start" : "items-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        msg.isAdmin
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          : "bg-slate-500 text-white"
                      )}
                    >
                      <div className="font-semibold text-xs mb-1">
                        {msg.sender}
                      </div>
                      <div>{msg.message}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {msg.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-slate-300/20 dark:border-slate-600/30">
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 rounded-xl border-slate-300/50 dark:border-slate-600/50 focus:border-slate-500 dark:focus:border-slate-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="px-3 rounded-xl bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
