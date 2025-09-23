#!/usr/bin/env node

/**
 * Set Admin Role Script
 * 
 * Usage: node scripts/set-admin.js <clerk_user_id>
 * 
 * This script sets a user as an admin in the user_roles table.
 * You can find the Clerk user ID in the Clerk dashboard or from the user's profile.
 */

const { Client } = require('postgres');

async function setAdmin(userId) {
  if (!userId) {
    console.error('❌ Error: Clerk user ID is required');
    console.log('Usage: node scripts/set-admin.js <clerk_user_id>');
    process.exit(1);
  }

  // Validate UUID format (Clerk user IDs are UUIDs)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('❌ Error: Invalid Clerk user ID format');
    console.log('Clerk user IDs should be UUIDs (e.g., user_2abc123def456...)');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if user already has a role
    const existingRole = await client.query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [userId]
    );

    if (existingRole.rows.length > 0) {
      const currentRole = existingRole.rows[0].role;
      if (currentRole === 'admin') {
        console.log('✅ User is already an admin');
        return;
      } else {
        console.log(`⚠️  User currently has role: ${currentRole}`);
      }
    }

    // Set user as admin
    await client.query(`
      INSERT INTO user_roles (user_id, role, created_at)
      VALUES ($1, 'admin', NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET role = 'admin', created_at = NOW()
    `, [userId]);

    console.log('✅ Successfully set user as admin');
    console.log(`   User ID: ${userId}`);
    console.log(`   Role: admin`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('❌ Error setting admin role:', error.message);
    
    if (error.message.includes('relation "user_roles" does not exist')) {
      console.log('\n💡 Tip: Make sure you have run the database migrations:');
      console.log('   Run the migration: db/migrations/005_user_roles.sql');
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Check your DATABASE_URL environment variable');
      console.log('   Make sure your database is accessible and the URL is correct');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  console.log('Please set your database connection string:');
  console.log('export DATABASE_URL="postgresql://user:password@host:port/database"');
  process.exit(1);
}

setAdmin(userId);
