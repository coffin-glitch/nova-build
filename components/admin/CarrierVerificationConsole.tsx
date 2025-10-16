"use client";

import { Button } from "@/components/ui/button";
import { useClerkRole } from "@/lib/clerk-roles";
import { cn } from "@/lib/utils";
import { Eye, Monitor, RefreshCw, Truck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CarrierVerificationConsole() {
  const { isAdmin } = useClerkRole();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 }); // Safe default for SSR
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  
  const buttonRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Set initial position on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 200, y: 200 });
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

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleButtonClick = () => {
    const dragDuration = Date.now() - dragStartTime;
    // Only open console if not dragging and enough time has passed since drag start
    if (!isDragging && dragDuration < 200) {
      setIsOpen(true);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
        {/* Floating Carrier Verification Button */}
        <div
          ref={buttonRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "relative cursor-move select-none",
            isDragging && "cursor-grabbing"
          )}
        >
          <Button
            onClick={handleButtonClick}
            className={cn(
              "h-16 w-16 rounded-full p-0 transition-all duration-200 ease-out",
              "bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700",
              "hover:from-blue-600 hover:via-blue-700 hover:to-blue-800",
              "shadow-2xl hover:shadow-3xl hover:scale-110",
              "border-2 border-blue-300/50 backdrop-blur-sm",
              "text-white font-bold",
              "cursor-move select-none",
              isDragging && "scale-105 cursor-grabbing",
              isOpen && "scale-0 opacity-0"
            )}
            style={{ userSelect: 'none' }}
            title="Open Carrier Verification Console"
          >
            <Eye className="h-8 w-8" />
          </Button>
        </div>
      </div>

      {/* Carrier Verification Console */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Console Bubble */}
          <div 
            className="fixed z-50 animate-in slide-in-from-bottom-4 duration-500 ease-out"
            style={{
              left: Math.min(position.x, window.innerWidth - 400), // 400px for console width
              top: Math.min(position.y - 500, window.innerHeight - 500), // 500px for console height
            }}
          >
            {/* Bubble Tail */}
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-700 rotate-45 border-r border-b border-blue-300/50"></div>
            
            {/* Main Console Window */}
            <div className="relative bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-blue-900 rounded-3xl shadow-2xl border-2 border-blue-300/50 dark:border-blue-600/50 backdrop-blur-lg overflow-hidden w-96 h-[500px] flex flex-col">
              {/* Console Header */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-700/30 dark:to-blue-800/30 border-b border-blue-300/20 dark:border-blue-600/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 dark:bg-blue-600/30 rounded-full">
                    <Truck className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-700 dark:text-blue-200">Carrier Console</h3>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Admin verification tool</p>
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

              {/* Console Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Carrier Features */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-200 flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Carrier Features
                  </h4>
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left h-auto p-3 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-800/30"
                      onClick={() => window.open('/find-loads', '_blank')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Truck className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-blue-700 dark:text-blue-200">Find Loads</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Browse available loads</div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left h-auto p-3 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-800/30"
                      onClick={() => window.open('/bid-board', '_blank')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                          <Eye className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-blue-700 dark:text-blue-200">Bid Board</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Live auctions</div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left h-auto p-3 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-800/30"
                      onClick={() => window.open('/booked-loads', '_blank')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                          <Monitor className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-blue-700 dark:text-blue-200">Booked Loads</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Manage shipments</div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left h-auto p-3 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-800/30"
                      onClick={() => window.open('/pricing', '_blank')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                          <Monitor className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-blue-700 dark:text-blue-200">Pricing</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Rate calculator</div>
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-200 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Quick Actions
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl border-blue-300/50 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/30"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>
                </div>

                {/* Status Overview */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-200">Status Overview</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">Loads</div>
                      <div className="text-sm font-bold text-green-700 dark:text-green-300">Active</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Bidding</div>
                      <div className="text-sm font-bold text-blue-700 dark:text-blue-300">Live</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                      <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Pricing</div>
                      <div className="text-sm font-bold text-purple-700 dark:text-purple-300">Ready</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-200 dark:border-orange-800">
                      <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">System</div>
                      <div className="text-sm font-bold text-orange-700 dark:text-orange-300">Online</div>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 text-sm">How to Use</h4>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Click features to open in new tabs</li>
                    <li>• Verify carrier UI elements</li>
                    <li>• Test permissions & functionality</li>
                    <li>• Drag this console to reposition</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
