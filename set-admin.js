const sql = require('./lib/db.ts').default;

async function setAdminAccess() {
  try {
    // For now, let's set admin access for any user with dukeisaac12@gmail.com
    // In a real app, you'd get the actual Clerk user ID
    const adminEmail = 'dukeisaac12@gmail.com';
    
    // Insert a placeholder admin user - you'll need to replace this with actual Clerk user ID
    const result = await sql`
      INSERT INTO user_roles (clerk_user_id, role, created_at) 
      VALUES ('admin_placeholder', 'admin', NOW())
      ON CONFLICT (clerk_user_id) 
      DO UPDATE SET role = 'admin'
    `;
    
    console.log('Admin access set up. You may need to update the clerk_user_id with your actual Clerk user ID.');
    console.log('To find your Clerk user ID, check the browser console or Clerk dashboard.');
    
  } catch (error) {
    console.error('Error setting admin access:', error);
  }
}

setAdminAccess();
