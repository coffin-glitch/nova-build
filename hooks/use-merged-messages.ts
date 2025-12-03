import { useMemo } from 'react'
import type { ChatMessage } from '@/components/chat/ChatMessageItem'

/**
 * Hook to merge realtime messages with database messages
 * Prevents duplicates and sorts by creation date
 * 
 * Based on @supabase/realtime-chat-nextjs pattern
 */
export function useMergedMessages(
  realtimeMessages: ChatMessage[],
  databaseMessages: ChatMessage[] = []
) {
  const allMessages = useMemo(() => {
    const mergedMessages = [...databaseMessages, ...realtimeMessages]

    // Remove duplicates based on message id
    const uniqueMessages = mergedMessages.filter(
      (message, index, self) => index === self.findIndex((m) => m.id === message.id)
    )

    // Sort by creation date
    const sortedMessages = uniqueMessages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return sortedMessages
  }, [databaseMessages, realtimeMessages])

  return allMessages
}

