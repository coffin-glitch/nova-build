import { syncAllUsers, initializeRoleCache } from "@/lib/role-manager";

// Initialize the role cache on startup
export async function initializeRoleSystem() {
  try {
    console.log("🚀 Initializing role management system...");
    await initializeRoleCache();
    console.log("✅ Role management system initialized");
  } catch (error) {
    console.error("❌ Error initializing role management system:", error);
  }
}

// Background sync function
export async function backgroundRoleSync() {
  try {
    console.log("🔄 Starting background role sync...");
    await syncAllUsers();
    console.log("✅ Background role sync completed");
  } catch (error) {
    console.error("❌ Error in background role sync:", error);
  }
}

// Auto-sync every 5 minutes
if (typeof window === "undefined") {
  // Only run on server side
  setInterval(backgroundRoleSync, 5 * 60 * 1000); // 5 minutes
  
  // Initial sync after 30 seconds
  setTimeout(backgroundRoleSync, 30 * 1000);
}
