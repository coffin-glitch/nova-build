import sql from "../lib/db";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration() {
  try {
    console.log("🔄 Running migration 087: Create admin_profiles table...");
    
    const migrationPath = join(process.cwd(), "db/migrations/087_create_admin_profiles.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    
    await sql.unsafe(migrationSQL);
    
    console.log("✅ Migration 087 completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();

