import sql from "@/lib/db.server";
import { getSupabaseService } from "@/lib/supabase";

export type UserRole = "admin" | "carrier" | "none";

interface CachedUserRole {
  supabase_user_id: string;
  role: UserRole;
  email: string;
  last_synced: Date;
}

class OptimizedRoleManager {
  private static instance: OptimizedRoleManager;
  private roleCache = new Map<string, { role: UserRole; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  static getInstance(): OptimizedRoleManager {
    if (!OptimizedRoleManager.instance) {
      OptimizedRoleManager.instance = new OptimizedRoleManager();
    }
    return OptimizedRoleManager.instance;
  }

  /**
   * Get user role with optimized caching
   */
  async getUserRole(userId: string): Promise<UserRole> {
    try {
      // Check memory cache first
      const cached = this.roleCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.role;
      }

      // Check database cache
      const dbCached = await this.getCachedRoleFromDB(userId);
      if (dbCached && this.isDBCacheValid(dbCached)) {
        // Update memory cache
        this.roleCache.set(userId, {
          role: dbCached.role,
          timestamp: Date.now()
        });
        return dbCached.role;
      }

      // If cache is stale, try to get from Supabase (but don't block)
      this.syncUserFromSupabaseAsync(userId);

      // Return cached role even if stale, or default to carrier
      if (dbCached) {
        this.roleCache.set(userId, {
          role: dbCached.role,
          timestamp: Date.now()
        });
        return dbCached.role;
      }

      // Default to carrier for authenticated users
      const defaultRole: UserRole = "carrier";
      this.roleCache.set(userId, {
        role: defaultRole,
        timestamp: Date.now()
      });
      return defaultRole;

    } catch (error) {
      console.error(`Error getting role for ${userId}:`, error);
      return "carrier"; // Safe default
    }
  }

  /**
   * Get cached role from database
   */
  private async getCachedRoleFromDB(userId: string): Promise<CachedUserRole | null> {
    try {
      const result = await sql`
        SELECT supabase_user_id, role, email, last_synced 
        FROM user_roles_cache 
        WHERE supabase_user_id = ${userId}
        LIMIT 1
      `;
      
      const rows = result as Array<Record<string, unknown>>;
      if (rows.length === 0) return null;
      
      const row = rows[0];
      return {
        supabase_user_id: row.supabase_user_id as string,
        role: row.role as UserRole,
        email: row.email as string,
        last_synced: new Date(row.last_synced as string | Date),
      };
    } catch (error) {
      console.error("Error getting cached role from DB:", error);
      return null;
    }
  }

  /**
   * Check if database cache is valid
   */
  private isDBCacheValid(cachedRole: CachedUserRole): boolean {
    const now = Date.now();
    const cacheAge = now - cachedRole.last_synced.getTime();
    return cacheAge < this.DB_CACHE_TTL;
  }

  /**
   * Async sync from Supabase (non-blocking)
   */
  private async syncUserFromSupabaseAsync(userId: string): Promise<void> {
    // Run in background without awaiting
    setImmediate(async () => {
      try {
        const supabaseUser = await this.fetchSupabaseUser(userId);
        if (supabaseUser) {
          await this.updateCachedRole(userId, supabaseUser);
          // Update memory cache
          this.roleCache.set(userId, {
            role: this.extractRoleFromSupabaseUser(supabaseUser),
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error(`Background sync failed for ${userId}:`, error);
      }
    });
  }

  /**
   * Fetch user from Supabase Auth Admin API
   */
  private async fetchSupabaseUser(userId: string): Promise<{ email?: string; user_metadata?: Record<string, unknown> } | null> {
    try {
      const supabase = getSupabaseService();
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      
      if (error || !data?.user) {
        console.error(`Supabase API error for ${userId}:`, error);
        return null;
      }

      return {
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      };
    } catch (error) {
      console.error(`Error fetching Supabase user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update cached role in database
   */
  private async updateCachedRole(userId: string, supabaseUser: { email?: string; user_metadata?: Record<string, unknown> }): Promise<void> {
    try {
      const email = supabaseUser.email || "";
      const role = this.extractRoleFromSupabaseUser(supabaseUser);

      await sql`
        INSERT INTO user_roles_cache (
          supabase_user_id, 
          role, 
          email, 
          last_synced
        ) VALUES (
          ${userId},
          ${role},
          ${email},
          NOW()
        )
        ON CONFLICT (supabase_user_id) 
        DO UPDATE SET 
          role = ${role},
          email = ${email},
          last_synced = NOW()
      `;
    } catch (error) {
      console.error("Error updating cached role:", error);
    }
  }

  /**
   * Extract role from Supabase user metadata
   */
  private extractRoleFromSupabaseUser(supabaseUser: { user_metadata?: Record<string, unknown> }): UserRole {
    // Check user_metadata for role
    if (supabaseUser.user_metadata?.role) {
      const role = String(supabaseUser.user_metadata.role).toLowerCase();
      if (role === "admin" || role === "carrier") {
        return role as UserRole;
      }
    }

    // Default to carrier for authenticated users
    return "carrier";
  }

  /**
   * Clear cache for a specific user
   */
  clearUserCache(userId: string): void {
    this.roleCache.delete(userId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.roleCache.clear();
  }
}

// Export singleton instance
export const optimizedRoleManager = OptimizedRoleManager.getInstance();

// Export convenience functions
export const getUserRole = (userId: string) => optimizedRoleManager.getUserRole(userId);
export const isAdmin = (userId: string) => optimizedRoleManager.getUserRole(userId).then(role => role === "admin");
export const isCarrier = (userId: string) => optimizedRoleManager.getUserRole(userId).then(role => role === "carrier" || role === "admin");

