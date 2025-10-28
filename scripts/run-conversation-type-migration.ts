import sql from "@/lib/db";

async function runMigration() {
  try {
    console.log("Running conversation type migration...");
    
    // Add conversation_type column to conversations table
    await sql`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS conversation_type TEXT DEFAULT 'regular' 
      CHECK (conversation_type IN ('regular', 'appeal'))
    `;
    
    // Add comment for clarity
    await sql`
      COMMENT ON COLUMN conversations.conversation_type IS 'Type of conversation: regular (floating chat) or appeal (profile appeal decisions)'
    `;
    
    // Create index for better performance
    await sql`CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(conversation_type)`;
    
    // Update existing conversations to be 'regular' type (floating chat)
    await sql`
      UPDATE conversations 
      SET conversation_type = 'regular' 
      WHERE conversation_type IS NULL
    `;
    
    console.log("Migration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await sql.end();
  }
}

runMigration();
