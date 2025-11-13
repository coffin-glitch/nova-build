import sqlite from "@/lib/db-local";
import sql from "@/lib/db.server";

export type UserRole = "admin" | "carrier" | "none";

interface ClerkUser {
  id: string;
  email_addresses: Array<{
    email_address: string;
  }>;
  public_metadata: {
    role?: string;
  };
  private_metadata: {
    role?: string;
  };
  last_sign_in_at: number;
  created_at: number;
}

interface CachedUserRole {
  clerk_user_id: string;
  role: UserRole;
  email: string;
  last_synced: Date;
  clerk_updated_at: number;
}

class RoleManager {
  private static instance: RoleManager;
  private syncInProgress = false;
  private lastSyncTime = 0;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): RoleManager {
    if (!RoleManager.instance) {
      RoleManager.instance = new RoleManager();
    }
    return RoleManager.instance;
  }

  /**
   * Get the appropriate database connection
   */
  getDb() {
    // Use local SQLite for local development (when running locally)
    // Check if we're in a local environment by looking for the SQLite file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const sqlitePath = path.join(process.cwd(), 'storage', 'nova-build.db');
    
    if (fs.existsSync(sqlitePath)) {
      console.log("🔍 RoleManager: Using SQLite database (local development)");
      return sqlite;
    }
    
    console.log("🔍 RoleManager: Using PostgreSQL database (production)");
    return sql;
  }

  /**
   * Get user role with automatic fallback to cache
   */
  async getUserRole(userId: string): Promise<UserRole> {
    try {
      console.log(`🔍 RoleManager: Getting user role for ${userId}`);
      
      // First check local cache
      const cachedRole = await this.getCachedRole(userId);
      console.log(`📊 RoleManager: Cached role result for ${userId}:`, cachedRole);
      
      if (cachedRole && this.isCacheValid(cachedRole)) {
        console.log(`🎯 RoleManager: Using cached role for ${userId}: ${cachedRole.role}`);
        return cachedRole.role;
      }

      // If cache is stale or missing, try to sync from Clerk
      console.log(`🔄 RoleManager: Cache invalid for ${userId}, syncing from Clerk...`);
      await this.syncUserFromClerk(userId);
      
      // Try cache again after sync
      const updatedCachedRole = await this.getCachedRole(userId);
      console.log(`📊 RoleManager: Updated cached role after sync for ${userId}:`, updatedCachedRole);
      
      if (updatedCachedRole) {
        return updatedCachedRole.role;
      }

      // Fallback to legacy user_roles table
      console.log(`🔄 RoleManager: Checking legacy user_roles table for ${userId}...`);
      const legacyRole = await this.getLegacyRole(userId);
      console.log(`📊 RoleManager: Legacy role result for ${userId}:`, legacyRole);
      
      if (legacyRole) {
        console.log(`🎯 RoleManager: Found legacy role for ${userId}: ${legacyRole}`);
        // Update cache with legacy role
        await this.updateCachedRoleFromLegacy(userId, legacyRole);
        return legacyRole;
      }

      console.log(`❌ RoleManager: No role found for ${userId}, returning none`);
      return "none";
    } catch (error) {
      console.error(`❌ RoleManager: Error getting role for ${userId}:`, error);
      
      // Fallback to cache even if stale
      const cachedRole = await this.getCachedRole(userId);
      if (cachedRole) {
        return cachedRole.role;
      }

      // Final fallback to legacy table
      try {
        const legacyRole = await this.getLegacyRole(userId);
        return legacyRole || "none";
      } catch (legacyError) {
        console.error(`❌ RoleManager: Legacy fallback failed for ${userId}:`, legacyError);
        return "none";
      }
    }
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === "admin";
  }

  /**
   * Check if user is carrier or admin
   */
  async isCarrier(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === "carrier" || role === "admin";
  }

  /**
   * Sync all users from Clerk (background task)
   */
  async syncAllUsers(): Promise<void> {
    if (this.syncInProgress) {
      console.log("🔄 RoleManager: Sync already in progress, skipping...");
      return;
    }

    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_INTERVAL) {
      console.log("⏰ RoleManager: Sync too recent, skipping...");
      return;
    }

    this.syncInProgress = true;
    this.lastSyncTime = now;

    try {
      console.log("🔄 RoleManager: Starting full sync from Clerk...");
      
      const clerkUsers = await this.fetchAllClerkUsers();
      console.log(`📊 RoleManager: Fetched ${clerkUsers.length} users from Clerk`);

      for (const user of clerkUsers) {
        await this.updateCachedRole(user);
      }

      console.log("✅ RoleManager: Full sync completed");
    } catch (error) {
      console.error("❌ RoleManager: Error during full sync:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync specific user from Clerk
   */
  private async syncUserFromClerk(userId: string): Promise<void> {
    try {
      const clerkUser = await this.fetchClerkUser(userId);
      if (clerkUser) {
        await this.updateCachedRole(clerkUser);
        console.log(`✅ RoleManager: Synced user ${userId} from Clerk`);
      }
    } catch (error) {
      console.error(`❌ RoleManager: Error syncing user ${userId}:`, error);
    }
  }

  /**
   * Fetch user from Clerk API
   */
  private async fetchClerkUser(userId: string): Promise<ClerkUser | null> {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`⚠️ RoleManager: User ${userId} not found in Clerk`);
        return null;
      }
      throw new Error(`Clerk API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetch all users from Clerk API
   */
  private async fetchAllClerkUsers(): Promise<ClerkUser[]> {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    const response = await fetch("https://api.clerk.com/v1/users?limit=500", {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Clerk API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.data || [];
  }

  /**
   * Get cached role from database
   */
  private async getCachedRole(userId: string): Promise<CachedUserRole | null> {
    try {
      console.log(`🔍 RoleManager: Getting cached role for ${userId}`);
      const db = this.getDb();
      const result = await db`
        SELECT clerk_user_id, role, email, last_synced, clerk_updated_at 
        FROM user_roles_cache 
        WHERE clerk_user_id = ${userId}
      `;
      
      console.log(`📊 RoleManager: Cache query result for ${userId}:`, result);
      
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        clerk_user_id: row.clerk_user_id,
        role: row.role as UserRole,
        email: row.email,
        last_synced: new Date(row.last_synced),
        clerk_updated_at: row.clerk_updated_at,
      };
    } catch (error) {
      console.error("❌ RoleManager: Error getting cached role:", error);
      return null;
    }
  }

  /**
   * Check if cached role is still valid
   */
  private isCacheValid(cachedRole: CachedUserRole): boolean {
    const now = Date.now();
    const cacheAge = now - cachedRole.last_synced.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return cacheAge < maxAge;
  }

  /**
   * Update cached role in database
   */
  private async updateCachedRole(clerkUser: ClerkUser): Promise<void> {
    try {
      const email = clerkUser.email_addresses[0]?.email_address || "";
      const role = this.extractRoleFromClerkUser(clerkUser);
      const clerkUpdatedAt = Math.max(
        clerkUser.last_sign_in_at || 0,
        clerkUser.created_at || 0
      );

      const db = this.getDb();
      await db`
        INSERT INTO user_roles_cache (
          clerk_user_id, 
          role, 
          email, 
          last_synced, 
          clerk_updated_at
        ) VALUES (
          ${clerkUser.id},
          ${role},
          ${email},
          datetime('now'),
          ${clerkUpdatedAt}
        )
        ON CONFLICT (clerk_user_id) 
        DO UPDATE SET 
          role = ${role},
          email = ${email},
          last_synced = datetime('now'),
          clerk_updated_at = ${clerkUpdatedAt}
      `;
    } catch (error) {
      console.error("❌ RoleManager: Error updating cached role:", error);
    }
  }

  /**
   * Extract role from Clerk user metadata
   */
  private extractRoleFromClerkUser(clerkUser: ClerkUser): UserRole {
    // Check public metadata first
    if (clerkUser.public_metadata?.role) {
      const role = clerkUser.public_metadata.role.toLowerCase();
      if (role === "admin" || role === "carrier") {
        return role as UserRole;
      }
    }

    // Check private metadata
    if (clerkUser.private_metadata?.role) {
      const role = clerkUser.private_metadata.role.toLowerCase();
      if (role === "admin" || role === "carrier") {
        return role as UserRole;
      }
    }

    // Default to carrier for authenticated users
    return "carrier";
  }

  /**
   * Get role from legacy user_roles table
   */
  private async getLegacyRole(userId: string): Promise<UserRole | null> {
    try {
      // Try user_id (legacy table uses user_id, not clerk_user_id)
      const db = this.getDb();
      const result = await db`
        SELECT role FROM user_roles WHERE user_id = ${userId}
      `;
      
      if (result.length > 0) {
        return result[0].role as UserRole;
      }
      
      return null;
    } catch (error) {
      console.error("❌ RoleManager: Error getting legacy role:", error);
      return null;
    }
  }

  /**
   * Update cache with legacy role
   */
  private async updateCachedRoleFromLegacy(userId: string, role: UserRole): Promise<void> {
    try {
      const db = this.getDb();
      await db`
        INSERT INTO user_roles_cache (
          clerk_user_id, 
          role, 
          email, 
          last_synced, 
          clerk_updated_at
        ) VALUES (
          ${userId},
          ${role},
          'legacy@example.com',
          datetime('now'),
          0
        )
        ON CONFLICT (clerk_user_id) 
        DO UPDATE SET 
          role = ${role},
          last_synced = datetime('now')
      `;
    } catch (error) {
      console.error("❌ RoleManager: Error updating cache from legacy:", error);
    }
  }

  /**
   * Initialize the role cache table
   */
  async initializeCache(): Promise<void> {
    try {
      const db = this.getDb();
      await db`
        CREATE TABLE IF NOT EXISTS user_roles_cache (
          clerk_user_id TEXT PRIMARY KEY,
          role TEXT NOT NULL CHECK (role IN ('admin', 'carrier', 'none')),
          email TEXT NOT NULL,
          last_synced DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          clerk_updated_at INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      console.log("✅ RoleManager: Cache table initialized");
    } catch (error) {
      console.error("❌ RoleManager: Error initializing cache:", error);
    }
  }

  /**
   * Get role statistics
   */
  async getRoleStats(): Promise<{
    total: number;
    admins: number;
    carriers: number;
    lastSync: Date | null;
  }> {
    try {
      const db = this.getDb();
      const result = await db`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
          COUNT(CASE WHEN role = 'carrier' THEN 1 END) as carriers,
          MAX(last_synced) as last_sync
        FROM user_roles_cache
      `;
      
      const row = result[0];
      return {
        total: parseInt(row.total),
        admins: parseInt(row.admins),
        carriers: parseInt(row.carriers),
        lastSync: row.last_sync ? new Date(row.last_sync) : null,
      };
    } catch (error) {
      console.error("❌ RoleManager: Error getting role stats:", error);
      return { total: 0, admins: 0, carriers: 0, lastSync: null };
    }
  }
}

// Export singleton instance
export const roleManager = RoleManager.getInstance();

// Export convenience functions
export const getUserRole = (userId: string) => roleManager.getUserRole(userId);
export const isAdmin = (userId: string) => roleManager.isAdmin(userId);
export const isCarrier = (userId: string) => roleManager.isCarrier(userId);
export const syncAllUsers = () => roleManager.syncAllUsers();
export const getRoleStats = () => roleManager.getRoleStats();
export const initializeRoleCache = () => roleManager.initializeCache();
