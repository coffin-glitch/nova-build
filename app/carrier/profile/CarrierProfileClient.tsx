"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Clock,
  Edit3,
  History,
  Info,
  Lock,
  MessageSquare,
  Phone,
  Save,
  Truck,
  User,
  XCircle
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = async (url: string) => {
  // Create abort controller for timeout (compatible with all browsers)
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;
  
  try {
    // Set timeout to abort request after 15 seconds
    timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000); // 15 second timeout
    
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    // Clear timeout if request succeeded
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }
    
    return response.json();
  } catch (error) {
    // Clear timeout in error case too
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Handle abort errors (timeouts or manual aborts)
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
      // Check if it's a timeout (no response yet) vs network error
      console.warn(`[CarrierProfileClient] Request aborted for ${url} - this may be a timeout or network issue`);
      throw new Error('Request timed out or was cancelled. The server may be slow or unreachable. Please try refreshing the page.');
    }
    
    // Handle network errors
    if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      console.error(`[CarrierProfileClient] Network error for ${url}:`, error);
      throw new Error('Network error: Unable to connect to the server. Please check your internet connection and try again.');
    }
    
    console.error(`[CarrierProfileClient] Error fetching ${url}:`, error);
    throw error instanceof Error ? error : new Error('Failed to fetch profile');
  }
};

interface CarrierProfile {
  id: string;
  supabase_user_id: string;
  legal_name: string;
  company_name: string;
  mc_number: string;
  dot_number: string;
  contact_name: string;
  phone: string;
  is_locked: boolean;
  locked_at?: string;
  locked_by?: string;
  lock_reason?: string;
  profile_status: 'pending' | 'approved' | 'declined' | 'open';
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  decline_reason?: string;
  is_first_login: boolean;
  profile_completed_at?: string;
  edits_enabled: boolean;
  edits_enabled_by?: string;
  edits_enabled_at?: string;
  created_at: string;
  updated_at: string;
}

interface ProfileHistory {
  id: number;
  carrier_user_id: string;
  profile_data: CarrierProfile;
  profile_status: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  decline_reason?: string;
  version_number: number;
  created_at: string;
}

// Inner component that uses useSearchParams - must be wrapped in Suspense
function CarrierProfileClientInner() {
  const { user, isLoaded } = useUnifiedUser();
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAppealChat, setShowAppealChat] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [isSendingAppeal, setIsSendingAppeal] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const searchParams = useSearchParams();
  const setupMode = searchParams.get('setup') === 'true';
  const status = searchParams.get('status');
  
  // Client-side auth check - redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
    }
  }, [isLoaded, user, router]);

  const { data, mutate, isLoading: profileLoading, error: profileError } = useSWR(
    `/api/carrier/profile`,
    fetcher,
    {
      fallbackData: { ok: true, data: null },
      // Don't retry on errors - show error state immediately
      shouldRetryOnError: false,
      // Refresh interval - disabled for now to prevent excessive requests
      refreshInterval: 0,
      // Revalidate on focus - disabled to prevent unnecessary requests
      revalidateOnFocus: false,
      // Error retry configuration
      errorRetryCount: 0,
      errorRetryInterval: 0,
      // Dedupe requests - if multiple components request the same data, only one request is made
      dedupingInterval: 2000,
    }
  );

  const { data: historyData } = useSWR(
    showHistory ? `/api/carrier/profile/history` : null,
    fetcher,
    {
      fallbackData: { ok: true, data: [] }
    }
  );

  const profile = data?.data;
  const profileHistory: ProfileHistory[] = historyData?.data || [];
  
  // If we have an error and no profile, stop showing loading state
  // This prevents the stuck "Loading Profile..." message
  const isActuallyLoading = profileLoading && !profile && !profileError;

  const [formData, setFormData] = useState<Partial<CarrierProfile>>({
    legal_name: "",
    mc_number: "",
    dot_number: "",
    contact_name: "",
    phone: ""
  });

  // Track last initialized profile/user to prevent infinite loops
  const lastInitializedProfileId = useRef<string | null>(null);
  const lastInitializedUserId = useRef<string | null>(null);
  
  // Initialize form data from profile or user - only update when profile/user actually changes
  useEffect(() => {
    // If we have a profile and haven't initialized it yet, or it's a different profile
    if (profile?.id && profile.id !== lastInitializedProfileId.current) {
      setFormData({
        legal_name: profile.legal_name || "",
        mc_number: profile.mc_number || "",
        dot_number: profile.dot_number || "",
        contact_name: profile.contact_name || "",
        phone: profile.phone || ""
      });
      lastInitializedProfileId.current = profile.id;
    } 
    // If no profile but we have a user, and we haven't initialized for this user yet
    else if (!profile?.id && user?.id && user.id !== lastInitializedUserId.current) {
      const contactName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.email || "";
      
      if (contactName && !formData.contact_name) {
        setFormData(prev => ({
          ...prev,
          contact_name: contactName
        }));
      }
      lastInitializedUserId.current = user.id;
    }
  }, [profile?.id, user?.id]); // Only depend on IDs to prevent infinite loops

  // Auto-enable editing mode when in setup mode and profile doesn't exist or can be edited
  useEffect(() => {
    const canEditProfile = !profile || 
      profile.profile_status === 'open' ||
      (profile.profile_status !== 'pending' && 
       ((profile.profile_status === 'declined' && profile.edits_enabled) ||
        (profile.profile_status === 'approved' && profile.edits_enabled)));
    
    if (setupMode && !profileLoading && !isEditing && canEditProfile) {
      setIsEditing(true);
    }
  }, [setupMode, profileLoading, profile, isEditing]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    // Show confirmation dialog before submitting
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Add timeout controller to prevent hanging
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000); // 30 second timeout
      
      const response = await fetch('/api/carrier/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          ...formData,
          submit_for_approval: true // Flag to indicate this is a submission
        }),
      });
      
      // Clear timeout on success
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || "Profile submitted for approval!");
        setIsEditing(false);
        mutate(); // Refresh profile data
        // Redirect to show pending status
        router.push('/carrier/profile?status=pending');
      } else {
        // Try to parse error response, but handle non-JSON responses gracefully
        let errorMessage = 'Failed to submit profile';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
          }
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      // Clear timeout in error case
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      let errorMessage = "Failed to submit profile";
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          errorMessage = 'Request timed out. The server may be slow or unreachable. Please try again.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Network error: Unable to connect to the server. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      console.error('[CarrierProfileClient] Error saving profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isProfileComplete = () => {
    return formData.legal_name && 
           formData.mc_number && 
           formData.contact_name && 
           formData.phone;
  };

  const getCompletionPercentage = () => {
    const requiredFields = ['legal_name', 'mc_number', 'contact_name', 'phone'];
    const completedFields = requiredFields.filter(field => formData[field as keyof typeof formData]);
    return Math.round((completedFields.length / requiredFields.length) * 100);
  };

  const handleSendAppeal = async () => {
    if (!appealMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSendingAppeal(true);
    try {
      // Create a new appeal conversation and send the appeal message
      const response = await fetch('/api/carrier/appeal-conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `APPEAL: ${appealMessage}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send appeal');
      }

      toast.success("Appeal message sent successfully");
      setAppealMessage("");
      setShowAppealChat(false);
      
      // Refresh conversation messages
      await fetchConversationMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send appeal");
      console.error(error);
    } finally {
      setIsSendingAppeal(false);
    }
  };

  const fetchConversationMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch('/api/carrier/appeal-conversations');
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.data && data.data.length > 0) {
          // Get the first appeal conversation's messages
          const conversationId = data.data[0].conversation_id;
          const messagesResponse = await fetch(`/api/carrier/appeal-conversations/${conversationId}`);
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            if (messagesData.ok) {
              setConversationMessages(messagesData.data || []);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Fetch messages when appeal chat is opened
  useEffect(() => {
    if (showAppealChat && profile?.profile_status === 'declined') {
      fetchConversationMessages();
    }
  }, [showAppealChat, profile?.profile_status]);

  // Status-specific rendering
  const renderStatusCard = () => {
    
    // Show error state if there's an error and no profile
    // Show error even if still loading - the request has failed
    if (profileError && !profile) {
      return (
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="font-semibold text-red-700">Error Loading Profile</h3>
                <p className="text-sm text-muted-foreground">
                  {profileError instanceof Error ? profileError.message : 'Failed to load profile. Please try refreshing the page.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Show loading state ONLY if we have no profile data at all AND no error (initial load)
    // Don't show it during re-fetches or if there's an error to prevent stuck loading states
    if (isActuallyLoading) {
      return (
        <Card className="border-l-4 border-l-gray-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-gray-500" />
              <div>
                <h3 className="font-semibold text-gray-700">Loading Profile...</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we load your profile information.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Show setup banner if:
    // 1. setupMode is true AND profile is null (new user needs to create profile)
    // 2. setupMode is true AND profile exists but is not approved/pending (profile needs updates)
    // 3. Profile status is 'open' (needs setup or edits enabled by admin)
    // Don't show it if profile is approved, even if setupMode is in URL
    // Don't show it while loading to prevent flickering
    if ((setupMode && !profileLoading && 
        (!profile || (profile && profile?.profile_status !== 'approved' && profile?.profile_status !== 'pending'))) ||
        profile?.profile_status === 'open') {
      return (
        <Card className="border-l-4 border-l-red-500 dark:border-l-red-400">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-400">Access Restricted</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Access to website features are restricted until you setup your profile and it has been reviewed by an admin.</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please complete your carrier profile below to gain access to all features and start bidding on loads.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (status === 'pending' || profile?.profile_status === 'pending') {
      return (
        <Card className="border-l-4 border-l-yellow-500 dark:border-l-yellow-400">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />
              <div>
                <h3 className="font-semibold text-yellow-700 dark:text-yellow-400">Pending Admin Review</h3>
                <p className="text-sm text-muted-foreground">
                  Your profile has been submitted and is currently under review by our admin team. Once submitted, modifications are not allowed until admin reviews.
                </p>
                {profile?.submitted_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {new Date(profile.submitted_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (status === 'declined' || profile?.profile_status === 'declined') {
      // Check if this is a reset profile (declined but edits enabled and no decline reason)
      const isResetProfile = profile?.profile_status === 'declined' && 
                            profile?.edits_enabled && 
                            !profile?.decline_reason;

      return (
        <Card className="border-l-4 border-l-red-500 dark:border-l-red-400">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
                <div>
                  <h3 className="font-semibold text-red-700 dark:text-red-400">
                    {isResetProfile ? 'Profile Reset - Please Update' : 'Profile Declined'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isResetProfile 
                      ? 'Your profile has been reset by our admin team. Please update your information and resubmit for review.'
                      : 'Your profile has been declined by our admin team.'
                    }
                  </p>
                  {!isResetProfile && profile?.decline_reason && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        <strong>Reason:</strong> {profile.decline_reason}
                      </p>
                    </div>
                  )}
                  {profile?.reviewed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reviewed: {new Date(profile.reviewed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!isResetProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAppealChat(!showAppealChat)}
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {showAppealChat ? 'Hide Appeal' : 'Appeal Decision'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }


    if (profile?.profile_status === 'approved') {
      return (
        <Card className="border-l-4 border-l-green-500 dark:border-l-green-400">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 dark:text-green-400" />
                <div>
                  <h3 className="font-semibold text-green-700 dark:text-green-400">Profile Approved</h3>
                  <p className="text-sm text-muted-foreground">
                    Your profile has been approved! You can now access all carrier features.
                  </p>
                  {profile?.reviewed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Approved: {new Date(profile.reviewed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="default" className="bg-green-500 dark:bg-green-600">
                Approved
              </Badge>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Default case - profile loaded but no specific status
    return (
      <Card className="border-l-4 border-l-gray-500">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-gray-500" />
            <div>
              <h3 className="font-semibold text-gray-700">Profile Status</h3>
              <p className="text-sm text-muted-foreground">
                Profile status: {profile?.profile_status || 'Unknown'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAppealChat = () => {
    if (profile?.profile_status === 'declined' && showAppealChat) {
      return (
        <Card className="mt-4 border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Appeal Decision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">Admin Message:</h4>
                <p className="text-sm text-muted-foreground">
                  {profile.decline_reason || "Your profile has been declined. Please provide additional information or clarification."}
                </p>
                {profile.review_notes && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border-l-2 border-blue-200 dark:border-blue-700">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Admin Notes:</strong> {profile.review_notes}
                    </p>
                    {profile.reviewed_at && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        <strong>Admin Notes Date:</strong> {new Date(profile.reviewed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Conversation History */}
              {conversationMessages.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Conversation History:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                    {isLoadingMessages ? (
                      <div className="text-center text-sm text-muted-foreground">Loading messages...</div>
                    ) : (
                      conversationMessages.map((message, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg ${
                            message.sender_type === 'carrier'
                              ? 'bg-blue-100 dark:bg-blue-900/30 ml-4'
                              : 'bg-gray-100 dark:bg-gray-700 mr-4'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {message.sender_type === 'carrier' ? 'You' : 'Admin'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-500">
                              {new Date(message.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{message.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="appeal-message" className="text-gray-900 dark:text-gray-100">Your Response:</Label>
                <textarea
                  id="appeal-message"
                  className="w-full min-h-[100px] p-3 border rounded-md resize-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Please explain why you believe your profile should be approved or provide additional information..."
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSendAppeal}
                  disabled={isSendingAppeal || !appealMessage.trim()}
                  className="flex-1"
                >
                  {isSendingAppeal ? "Sending..." : "Send Appeal"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAppealChat(false)}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const canEdit = () => {
    if (!profile) return true; // New profile
    if (profile.profile_status === 'pending') return false;
    if (profile.profile_status === 'open') return true; // Open status means setup required or edits enabled, so allow editing
    if (profile.profile_status === 'declined') return profile.edits_enabled;
    if (profile.profile_status === 'approved') return profile.edits_enabled;
    return false;
  };

  const getEditButtonText = () => {
    if (!profile) return "Edit Profile";
    if (profile.profile_status === 'pending') return "Under Review";
    if (profile.profile_status === 'declined') return profile.edits_enabled ? "Edit Profile" : "Edits Locked";
    if (profile.profile_status === 'approved') return profile.edits_enabled ? "Edit Profile" : "Edits Locked";
    return "Edit Profile";
  };

  const getSaveButtonText = () => {
    if (!profile) return "Submit Profile";
    if (profile.profile_status === 'declined' && profile.edits_enabled) return "Resubmit Profile";
    if (profile.profile_status === 'approved' && profile.edits_enabled) return "Update Profile";
    return "Submit Profile";
  };

  const renderProfileHistory = () => {
    if (!showHistory) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle>Profile History</CardTitle>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowHistory(false)}
            >
              Close History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profileHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No profile history available.
            </p>
          ) : (
            <div className="space-y-4">
              {profileHistory.map((history, index) => (
                <div key={history.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Version {history.version_number}
                      </Badge>
                      <Badge 
                        variant={history.profile_status === 'approved' ? 'default' : 
                                history.profile_status === 'declined' ? 'destructive' : 'secondary'}
                        className={history.profile_status === 'approved' ? 'bg-green-500' : 
                                  history.profile_status === 'declined' ? 'bg-red-500' : ''}
                      >
                        {history.profile_status.charAt(0).toUpperCase() + history.profile_status.slice(1)}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(history.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Company:</strong> {history.profile_data.legal_name || history.profile_data.company_name}
                    </div>
                    <div>
                      <strong>MC #:</strong> {history.profile_data.mc_number}
                    </div>
                    <div>
                      <strong>Contact:</strong> {history.profile_data.contact_name}
                    </div>
                    <div>
                      <strong>Phone:</strong> {history.profile_data.phone}
                    </div>
                  </div>

                  {history.review_notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <strong className="text-sm">Review Notes:</strong>
                      <p className="text-sm text-muted-foreground mt-1">
                        {history.review_notes}
                      </p>
                    </div>
                  )}

                  {history.decline_reason && (
                    <div className="mt-3 p-3 bg-red-50 rounded-md">
                      <strong className="text-sm text-red-700">Decline Reason:</strong>
                      <p className="text-sm text-red-600 mt-1">
                        {history.decline_reason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Always render something - even if all checks fail
  const statusCard = renderStatusCard();
  
  return (
    <div className="space-y-6">
      {/* Status Card - always render something */}
      {statusCard || (
        <Card className="border-l-4 border-l-gray-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-gray-500" />
              <div>
                <h3 className="font-semibold text-gray-700">Carrier Profile</h3>
                <p className="text-sm text-muted-foreground">
                  {setupMode ? 'Please complete your profile below to get started.' : 'Manage your carrier profile.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Appeal Chat */}
      {renderAppealChat()}

      {/* Disclaimer */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-700 mb-2">Profile Verification Notice</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  You are free to use your personal information for this profile. However, for verification purposes, 
                  our team will be reaching out to the contact information on your "HighWay Profile" that matches your MC and Company name.
                </p>
                <p>
                  <strong>Important:</strong> If the contact person does not validate you as a dispatcher with their company, 
                  or if the company name, MC, or DOT numbers are DNU (Do Not Use) or incorrect, your application will be 
                  automatically denied with the opportunity to appeal.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Please ensure all information is accurate and up-to-date to avoid delays in the approval process.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Company Information</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {profile && profile.profile_status !== 'pending' && (
                <Button
                  variant="outline"
                  onClick={() => setShowHistory(!showHistory)}
                  size="sm"
                >
                  <History className="h-4 w-4 mr-2" />
                  {showHistory ? 'Hide History' : 'View History'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                disabled={isLoading || !canEdit()}
                className={!canEdit() ? "opacity-50 cursor-not-allowed" : ""}
              >
                {canEdit() ? (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    {getEditButtonText()}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    {getEditButtonText()}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legal_name">Company Name *</Label>
                <Input
                  id="legal_name"
                  value={formData.legal_name || ""}
                  onChange={(e) => handleInputChange("legal_name", e.target.value)}
                  disabled={!isEditing || !canEdit()}
                  placeholder="Enter your company name"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="contact_name">Contact Name *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-sm">
                          Your contact name will be used as your account full name throughout the platform. 
                          If you enter an email address, only the part before @ will be used.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="contact_name"
                  value={formData.contact_name || ""}
                  onChange={(e) => handleInputChange("contact_name", e.target.value)}
                  disabled={!isEditing || !canEdit()}
                  placeholder="Enter contact person name"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border my-4" />

          {/* Carrier Credentials */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Carrier Credentials
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mc_number">MC Number *</Label>
                <Input
                  id="mc_number"
                  value={formData.mc_number || ""}
                  onChange={(e) => handleInputChange("mc_number", e.target.value)}
                  disabled={!isEditing || !canEdit()}
                  placeholder="Enter MC number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dot_number">DOT Number</Label>
                <Input
                  id="dot_number"
                  value={formData.dot_number || ""}
                  onChange={(e) => handleInputChange("dot_number", e.target.value)}
                  disabled={!isEditing || !canEdit()}
                  placeholder="Enter DOT number (if applicable)"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border my-4" />

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  disabled={!isEditing || !canEdit()}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          {isEditing && canEdit() && (
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={isLoading || !isProfileComplete()}
                style={{ backgroundColor: accentColor }}
                className="px-8"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {getSaveButtonText()}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Confirmation Dialog */}
          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Profile Submission</DialogTitle>
                <DialogDescription>
                  Once submitted, modifications are not allowed until admin reviews your profile.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to submit your profile for review? You will not be able to make changes until an admin reviews and approves your profile.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSave}
                  disabled={isLoading}
                  style={{ backgroundColor: accentColor }}
                >
                  {isLoading ? "Submitting..." : "Submit for Review"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Profile Completion Warning */}
          {isEditing && !isProfileComplete() && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-700">
                  Please complete all required fields (marked with *) before submitting your profile.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile History */}
      {renderProfileHistory()}
    </div>
  );
}

// Wrapper component with Suspense for useSearchParams
export function CarrierProfileClient() {
  return (
    <Suspense fallback={
      <Card className="border-l-4 border-l-gray-500">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-gray-500" />
            <div>
              <h3 className="font-semibold text-gray-700">Loading Profile...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we load your profile information.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    }>
      <CarrierProfileClientInner />
    </Suspense>
  );
}
