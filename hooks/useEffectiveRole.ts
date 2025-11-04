"use client";

import { useAdminView } from '@/components/providers/AdminViewProvider';
import { useUnifiedRole } from '@/hooks/useUnifiedRole';

export type EffectiveUserRole = "admin" | "carrier" | "none";

/**
 * Hook that provides the effective user role based on current view mode
 * For admins in carrier view mode, returns 'carrier' to simulate carrier experience
 * (Supabase-only)
 */
export function useEffectiveRole() {
  const { role, isAdmin, isCarrier } = useUnifiedRole();
  const { isCarrierView, effectiveRole } = useAdminView();

  // If user is admin and in carrier view mode, return carrier
  if (isAdmin && isCarrierView) {
    return {
      role: 'carrier' as EffectiveUserRole,
      isAdmin: false,
      isCarrier: true,
      isLoading: false,
      error: null,
      isSimulated: true, // Indicates this is a simulated role
      actualRole: role, // The user's actual role
    };
  }

  // Otherwise return the actual role
  return {
    role: role as EffectiveUserRole,
    isAdmin,
    isCarrier,
    isLoading: false,
    error: null,
    isSimulated: false,
    actualRole: role,
  };
}

/**
 * Hook for components that need to behave differently in carrier view mode
 */
export function useCarrierViewMode() {
  const { isCarrierView, isAdmin } = useAdminView();
  
  return {
    isCarrierViewMode: isCarrierView,
    isAdminUser: isAdmin,
    shouldShowCarrierUI: isCarrierView,
    shouldShowAdminUI: !isCarrierView,
  };
}
