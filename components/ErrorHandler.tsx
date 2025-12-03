"use client";

import { useEffect } from "react";

/**
 * Client-side error handler component
 * Catches unhandled errors and promise rejections for better debugging
 */
export function ErrorHandler() {
  useEffect(() => {
    // Handle unhandled errors
    const handleError = (event: ErrorEvent) => {
      const errorInfo = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        // Check if it's a temporal dead zone error
        isTDZError: event.message.includes("Cannot access") && event.message.includes("before initialization"),
      };
      
      console.error("🚨 [ErrorHandler] Unhandled error:", errorInfo);
      
      if (errorInfo.isTDZError) {
        console.error("🚨 [ErrorHandler] TDZ error detected. This indicates a circular dependency or initialization order issue.");
        console.error("🚨 [ErrorHandler] File:", event.filename, "Line:", event.lineno);
        console.error("🚨 [ErrorHandler] Stack:", event.error?.stack);
      }
    };
    
    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("🚨 [ErrorHandler] Unhandled promise rejection:", event.reason);
      if (event.reason instanceof Error) {
        console.error("🚨 [ErrorHandler] Rejection stack:", event.reason.stack);
      }
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
  
  return null; // This component doesn't render anything
}

