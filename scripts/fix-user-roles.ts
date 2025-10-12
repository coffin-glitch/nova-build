import sql from '../lib/db.server';

async function fixUserRoles() {
  try {
    console.log('🔧 Fixing user roles...');
    
    // Check what's in user_roles table
    const userRoles = await sql`SELECT * FROM user_roles`;
    console.log('📊 User roles table:', userRoles);
    
    // Check what's in user_roles_cache table
    const userRolesCache = await sql`SELECT * FROM user_roles_cache`;
    console.log('📊 User roles cache table:', userRolesCache);
    
    // Set the admin user in both tables
    const adminUserId = 'user_32rETqJKqkofN1iiURTXDp0xic4';
    
    // Update user_roles table
    await sql`
      INSERT INTO user_roles (user_id, role, created_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT (user_id)
      DO UPDATE SET 
        role = ?
    `(adminUserId, 'admin', 'admin');
    
    // Update user_roles_cache table
    await sql`
      INSERT INTO user_roles_cache (
        clerk_user_id, 
        role, 
        email, 
        last_synced, 
        clerk_updated_at
      ) VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT (clerk_user_id) 
      DO UPDATE SET 
        role = ?,
        email = ?,
        last_synced = datetime('now'),
        clerk_updated_at = ?
    `(adminUserId, 'admin', 'dukeisaac12@gmail.com', Date.now(), 'admin', 'dukeisaac12@gmail.com', Date.now());
    
    console.log('✅ Fixed user roles');
    
    // Verify the fix
    const updatedRoles = await sql`SELECT * FROM user_roles WHERE user_id = ?`(adminUserId);
    const updatedCache = await sql`SELECT * FROM user_roles_cache WHERE clerk_user_id = ?`(adminUserId);
    
    console.log('✅ Updated user_roles:', updatedRoles);
    console.log('✅ Updated user_roles_cache:', updatedCache);
    
  } catch (error) {
    console.error('❌ Error fixing user roles:', error);
  }
}

fixUserRoles();
