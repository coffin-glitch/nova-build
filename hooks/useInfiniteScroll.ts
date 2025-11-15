import { useEffect, useRef, useCallback, useState } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  threshold?: number; // Percentage from bottom to trigger (0-1)
  rootMargin?: string; // CSS margin for root
  enabled?: boolean; // Enable/disable the observer
}

/**
 * Custom hook for infinite scroll using Intersection Observer API
 * Best practices implementation:
 * - Uses Intersection Observer for performance
 * - Properly handles cleanup
 * - Debounces load more calls
 * - Works with any scroll container
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  threshold = 0.1, // Trigger when 10% of sentinel is visible
  rootMargin = '100px', // Start loading 100px before sentinel
  enabled = true,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const isLoadingRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0); // Force re-render when sentinel becomes available

  // Debounced load more function
  const handleLoadMore = useCallback(() => {
    if (isLoadingRef.current || isLoading || isLoadingMore || !hasMore || !enabled) {
      return;
    }

    isLoadingRef.current = true;
    onLoadMore();

    // Reset loading flag after a short delay
    setTimeout(() => {
      isLoadingRef.current = false;
    }, 500);
  }, [hasMore, isLoading, isLoadingMore, onLoadMore, enabled]);

  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    // Wait for sentinel element to be available
    if (!sentinelRef.current) {
      // Retry after a short delay to check again
      const timeout = setTimeout(() => {
        if (sentinelRef.current && enabled) {
          setRetryCount(prev => prev + 1); // Trigger re-render
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: containerRef.current,
        rootMargin,
        threshold,
      }
    );

    // Observe the sentinel element
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, [enabled, handleLoadMore, rootMargin, threshold, retryCount]);

  // Set container ref (for scrollable parent)
  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
    // Re-initialize observer when container changes
    if (observerRef.current && sentinelRef.current) {
      observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting) {
            handleLoadMore();
          }
        },
        {
          root: element,
          rootMargin,
          threshold,
        }
      );
      if (sentinelRef.current) {
        observerRef.current.observe(sentinelRef.current);
      }
    }
  }, [handleLoadMore, rootMargin, threshold]);

  return {
    sentinelRef,
    setContainerRef,
  };
}

