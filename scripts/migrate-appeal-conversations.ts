import sql from "@/lib/db";

async function migrateAppealConversations() {
  try {
    console.log("Migrating existing appeal conversations...");
    
    // Find conversations that have appeal messages but are marked as regular
    const appealConversations = await sql`
      SELECT DISTINCT c.id, c.carrier_user_id, c.admin_user_id
      FROM conversations c
      JOIN conversation_messages cm ON cm.conversation_id = c.id
      WHERE (c.conversation_type = 'regular' OR c.conversation_type IS NULL)
      AND cm.message LIKE 'APPEAL:%'
    `;
    
    console.log(`Found ${appealConversations.length} conversations with appeal messages`);
    
    // Update these conversations to be appeal type
    for (const conv of appealConversations) {
      await sql`
        UPDATE conversations 
        SET conversation_type = 'appeal'
        WHERE id = ${conv.id}
      `;
      console.log(`Updated conversation ${conv.id} to appeal type`);
    }
    
    console.log("Migration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await sql.end();
  }
}

migrateAppealConversations();
