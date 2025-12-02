"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeOfferComments } from "@/hooks/useRealtimeOfferComments";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { 
  MessageSquare, 
  Send, 
  User, 
  Shield, 
  Clock,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface OfferComment {
  id: string;
  offer_id: string;
  author_id: string;
  author_role: 'admin' | 'carrier';
  comment_text: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  author_email?: string;
  author_display_name?: string;
}

interface OfferCommentsProps {
  offerId: string;
  userRole: 'admin' | 'carrier';
}

export default function OfferComments({ offerId, userRole }: OfferCommentsProps) {
  const { user } = useUnifiedUser();
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch comments using SWR with Realtime
  const { data: commentsData, mutate: mutateComments, isLoading: loading } = useSWR(
    offerId ? `/api/offers/${offerId}/comments` : null,
    fetcher,
    { refreshInterval: 60000 } // Reduced from polling - Realtime handles instant updates
  );

  const comments: OfferComment[] = commentsData?.comments || [];

  // Realtime updates for offer_comments
  useRealtimeOfferComments({
    offerId: offerId,
    onInsert: () => {
      mutateComments();
    },
    onUpdate: () => {
      mutateComments();
    },
    onDelete: () => {
      mutateComments();
    },
    enabled: !!offerId,
  });

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_text: newComment.trim(),
          is_internal: isInternal
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create comment');
      }

      const data = await response.json();
      mutateComments(); // Refresh comments via SWR
      setNewComment("");
      setIsInternal(false);
      toast.success('Comment added successfully');
    } catch (error: any) {
      console.error('Error creating comment:', error);
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCommentTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getAuthorIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'carrier':
        return <User className="h-4 w-4 text-green-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAuthorBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'carrier':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Filter comments based on user role and internal flag
  const visibleComments = comments.filter(comment => {
    if (userRole === 'admin') {
      return true; // Admins can see all comments
    } else {
      return !comment.is_internal; // Carriers can only see non-internal comments
    }
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({visibleComments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        <ScrollArea className="h-64 w-full">
          <div className="space-y-4 pr-4">
            {visibleComments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No comments yet</p>
                <p className="text-sm">Be the first to add a comment</p>
              </div>
            ) : (
              visibleComments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getAuthorIcon(comment.author_role)}
                      <Badge className={getAuthorBadgeColor(comment.author_role)}>
                        {comment.author_display_name || comment.author_role}
                      </Badge>
                      {comment.is_internal && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Internal
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatCommentTime(comment.created_at)}
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {comment.comment_text}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Add Comment Form */}
        {userRole === 'admin' && (
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="new-comment">Add Comment</Label>
              <Textarea
                id="new-comment"
                placeholder="Add a comment about this offer..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Shield className="h-4 w-4 text-muted-foreground" />
                Internal comment (carriers won't see this)
              </label>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={submitting || !newComment.trim()}
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Add Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {userRole === 'carrier' && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <AlertCircle className="h-4 w-4 mx-auto mb-2" />
            Only admins can add comments. Contact support if you need to communicate about this offer.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
