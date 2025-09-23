# Admin Setup Guide

## How to Mark Someone as Admin

To give a user admin privileges, you need to add their Clerk user ID to the `user_roles` table with the role "admin".

### Method 1: Using the Setup Script (Recommended)

```bash
# Set a user as admin
node scripts/set-admin.js <clerk_user_id>

# Example:
node scripts/set-admin.js user_2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

**Prerequisites:**
- `DATABASE_URL` environment variable must be set
- Database migrations must be run (including `005_user_roles.sql`)
- User must have a Clerk account

### Method 2: Direct Database Query

If you prefer to use SQL directly:

```sql
-- Insert new admin user
INSERT INTO user_roles (user_id, role, created_at)
VALUES ('user_2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz', 'admin', NOW())
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin', created_at = NOW();
```

### Finding Clerk User IDs

1. **From Clerk Dashboard:**
   - Go to your Clerk dashboard
   - Navigate to "Users"
   - Click on the user you want to make admin
   - Copy the User ID from the user details

2. **From Application Logs:**
   - Check your application logs when a user signs in
   - The user ID is logged during authentication

3. **From Database (if user already exists):**
   ```sql
   SELECT user_id FROM user_roles WHERE role = 'carrier';
   ```

### Role System

- **Default Role:** All new users are automatically assigned the "carrier" role
- **Admin Role:** Users with "admin" role can access all admin pages
- **Carrier Role:** Users with "carrier" role can access carrier pages and public pages
- **No Role:** Users without a role in the database default to "carrier"

### Troubleshooting

**Script fails with "relation user_roles does not exist":**
```bash
# Run the migration first
psql $DATABASE_URL -f db/migrations/005_user_roles.sql
```

**Script fails with connection error:**
```bash
# Check your DATABASE_URL
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
```

**User still can't access admin pages:**
1. Verify the user ID is correct
2. Check the database has the correct entry:
   ```sql
   SELECT * FROM user_roles WHERE user_id = 'your_user_id';
   ```
3. Clear browser cache and try signing in again

### Security Notes

- Only trusted users should be given admin access
- Admin users can access all data and modify system settings
- Consider implementing additional security measures for production use
- Regularly audit admin user list

### Example Workflow

1. User signs up for the first time
2. User gets default "carrier" role
3. You identify they need admin access
4. Get their Clerk user ID from the dashboard
5. Run: `node scripts/set-admin.js <their_user_id>`
6. User signs out and back in to refresh their role
7. User now has access to admin pages
