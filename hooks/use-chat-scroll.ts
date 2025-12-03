import { useCallback, useRef } from 'react'

/**
 * Hook for managing chat scroll behavior
 * Automatically scrolls to bottom when messages change
 * 
 * Based on @supabase/realtime-chat-nextjs pattern
 */
export function useChatScroll() {
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [])

  return { containerRef, scrollToBottom }
}

