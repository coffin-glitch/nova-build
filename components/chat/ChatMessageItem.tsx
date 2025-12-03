'use client'

import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  content: string
  user: {
    id: string
    name: string
  }
  createdAt: string
  attachment_url?: string
  attachment_type?: string
  attachment_name?: string
}

interface ChatMessageItemProps {
  message: ChatMessage
  isOwnMessage: boolean
  showHeader: boolean
  className?: string
}

/**
 * Reusable chat message item component
 * Based on @supabase/realtime-chat-nextjs pattern
 */
export const ChatMessageItem = ({ 
  message, 
  isOwnMessage, 
  showHeader,
  className 
}: ChatMessageItemProps) => {
  return (
    <div className={cn('flex mt-2', isOwnMessage ? 'justify-end' : 'justify-start', className)}>
      <div
        className={cn('max-w-[75%] w-fit flex flex-col gap-1', {
          'items-end': isOwnMessage,
        })}
      >
        {showHeader && (
          <div
            className={cn('flex items-center gap-2 text-xs px-3', {
              'justify-end flex-row-reverse': isOwnMessage,
            })}
          >
            <span className="font-medium">{message.user.name}</span>
            <span className="text-foreground/50 text-xs">
              {new Date(message.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={cn(
            'py-2 px-3 rounded-xl text-sm w-fit',
            isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
          )}
        >
          {message.content}
          {message.attachment_url && (
            <div className="mt-2">
              {message.attachment_type?.startsWith('image/') ? (
                <img 
                  src={message.attachment_url} 
                  alt={message.attachment_name || 'Attachment'} 
                  className="max-w-full rounded-lg"
                />
              ) : (
                <a
                  href={message.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline"
                >
                  📎 {message.attachment_name || 'Attachment'}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

