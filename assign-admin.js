#!/usr/bin/env node

/**
 * Script to assign admin role to a user
 * Usage: node assign-admin.js <clerk-user-id>
 */

const sql = require('postgres')(process.env.DATABASE_URL);

async function assignAdminRole(userId) {
  if (!userId) {
    console.error('❌ Please provide a Clerk user ID');
    console.log('Usage: node assign-admin.js <clerk-user-id>');
    process.exit(1);
  }

  try {
    console.log(`🔧 Assigning admin role to user: ${userId}`);
    
    // Try to insert/update with user_id column first
    try {
      await sql`
        INSERT INTO user_roles (user_id, role) 
        VALUES (${userId}, 'admin')
        ON CONFLICT (user_id) 
        DO UPDATE SET role = 'admin'
      `;
      console.log('✅ Admin role assigned successfully using user_id column');
    } catch (error) {
      console.log('🔄 Trying with clerk_user_id column...');
      // Fallback to clerk_user_id column
      await sql`
        INSERT INTO user_roles (clerk_user_id, role) 
        VALUES (${userId}, 'admin')
        ON CONFLICT (clerk_user_id) 
        DO UPDATE SET role = 'admin'
      `;
      console.log('✅ Admin role assigned successfully using clerk_user_id column');
    }
    
    // Verify the assignment
    let result = await sql`
      SELECT role FROM user_roles WHERE user_id = ${userId}
    `;
    
    if (result.length === 0) {
      result = await sql`
        SELECT role FROM user_roles WHERE clerk_user_id = ${userId}
      `;
    }
    
    if (result.length > 0) {
      console.log(`🎯 Verified: User ${userId} has role: ${result[0].role}`);
    } else {
      console.log('❌ Could not verify role assignment');
    }
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Error assigning admin role:', error);
    await sql.end();
    process.exit(1);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];
assignAdminRole(userId);
