"use client";

import { useUnifiedRole } from '@/hooks/useUnifiedRole';
import React, { createContext, useContext, useEffect, useState } from 'react';

type ViewMode = 'admin' | 'carrier';

interface AdminViewContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdmin: boolean;
  isCarrierView: boolean;
  effectiveRole: 'admin' | 'carrier';
}

const AdminViewContext = createContext<AdminViewContextType | undefined>(undefined);

export function AdminViewProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useUnifiedRole();
  const [viewMode, setViewMode] = useState<ViewMode>('admin');

  // Reset to admin view when user is not admin
  useEffect(() => {
    if (!isAdmin) {
      setViewMode('admin');
    }
  }, [isAdmin]);

  const isCarrierView = viewMode === 'carrier';
  const effectiveRole = isCarrierView ? 'carrier' : 'admin';

  const value: AdminViewContextType = {
    viewMode,
    setViewMode,
    isAdmin,
    isCarrierView,
    effectiveRole,
  };

  return (
    <AdminViewContext.Provider value={value}>
      {children}
    </AdminViewContext.Provider>
  );
}

export function useAdminView() {
  const context = useContext(AdminViewContext);
  if (context === undefined) {
    throw new Error('useAdminView must be used within an AdminViewProvider');
  }
  return context;
}
