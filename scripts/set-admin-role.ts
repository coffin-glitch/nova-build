import { config } from "dotenv";
import { setClerkUserRole } from "../lib/clerk-server";

// Load environment variables
config({ path: ".env.local" });

async function setAdminRole() {
  const userId = "user_32rETqJKqkofN1iiURTXDp0xic4"; // Current user ID from logs
  
  console.log("Environment check:");
  console.log("CLERK_SECRET_KEY:", process.env.CLERK_SECRET_KEY ? "✅ Set" : "❌ Missing");
  console.log("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:", process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "✅ Set" : "❌ Missing");
  
  try {
    console.log("Setting user role to admin...");
    await setClerkUserRole(userId, "admin");
    console.log("✅ Successfully set user role to admin");
  } catch (error) {
    console.error("❌ Error setting user role:", error);
  }
}

setAdminRole();
