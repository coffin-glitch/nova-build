"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CustomScrollbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function CustomScrollbar({ containerRef, className = "" }: CustomScrollbarProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScrollProgress = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
      setScrollProgress(progress);
      setIsVisible(scrollHeight > clientHeight);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!thumbRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartScrollTop.current = container.scrollTop;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      
      const deltaY = e.clientY - dragStartY.current;
      const scrollbarHeight = scrollbarRef.current?.clientHeight || 0;
      const thumbHeight = thumbRef.current?.clientHeight || 0;
      const scrollableHeight = scrollbarHeight - thumbHeight;
      const scrollRatio = deltaY / scrollableHeight;
      
      const { scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      const newScrollTop = dragStartScrollTop.current + (scrollRatio * maxScroll);
      
      container.scrollTop = Math.max(0, Math.min(maxScroll, newScrollTop));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    container.addEventListener("scroll", updateScrollProgress);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    scrollbarRef.current?.addEventListener("mousedown", handleMouseDown);
    
    updateScrollProgress();

    return () => {
      container.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      scrollbarRef.current?.removeEventListener("mousedown", handleMouseDown);
    };
  }, [containerRef, isDragging]);

  const handleScrollbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (thumbRef.current?.contains(e.target as Node)) return;
    
    const container = containerRef.current;
    if (!container) return;

    const rect = scrollbarRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickY = e.clientY - rect.top;
    const scrollbarHeight = rect.height;
    const thumbHeight = thumbRef.current?.clientHeight || 0;
    const scrollableHeight = scrollbarHeight - thumbHeight;
    const clickRatio = clickY / scrollableHeight;

    const { scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    container.scrollTop = clickRatio * maxScroll;
  };

  const scrollUp = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ top: -200, behavior: "smooth" });
  };

  const scrollDown = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ top: 200, behavior: "smooth" });
  };

  if (!isVisible) return null;

  const thumbHeight = Math.max(20, 100 - scrollProgress * 0.8); // Minimum 20px, scales with content

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        onClick={scrollUp}
        className="w-8 h-8 rounded-full bg-background/40 backdrop-blur-md border border-border/50 hover:bg-background/60 transition-all duration-200 flex items-center justify-center group"
        aria-label="Scroll up"
      >
        <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
      
      <div
        ref={scrollbarRef}
        onClick={handleScrollbarClick}
        className="flex-1 w-2 bg-background/20 backdrop-blur-sm rounded-full border border-border/30 relative cursor-pointer hover:bg-background/30 transition-colors"
        style={{ minHeight: "200px" }}
      >
        <div
          ref={thumbRef}
          className="absolute left-0 right-0 bg-background/60 backdrop-blur-md rounded-full border border-border/50 hover:bg-background/80 transition-all duration-200 cursor-grab active:cursor-grabbing shadow-lg"
          style={{
            top: `${scrollProgress}%`,
            height: `${thumbHeight}%`,
            transform: "translateY(-50%)",
          }}
        />
      </div>

      <button
        onClick={scrollDown}
        className="w-8 h-8 rounded-full bg-background/40 backdrop-blur-md border border-border/50 hover:bg-background/60 transition-all duration-200 flex items-center justify-center group"
        aria-label="Scroll down"
      >
        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
    </div>
  );
}

