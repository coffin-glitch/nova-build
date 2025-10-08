# Dev Admin System Setup

## Environment Variables

Add this to your `.env.local` file:

```bash
# Dev Admin Key (change this to whatever you want)
DEV_ADMIN_KEY=nova-dev-2024-admin-key

# Clerk Integration (required for real user data)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

## How to Use

1. **Access the Dev Console**: Go to `/dev-admin` on your site
2. **Enter Dev Key**: Use the key you set in `DEV_ADMIN_KEY`
3. **Manage Roles**: Assign admin or carrier roles to any user

## Features

- 🎮 **Game-like Interface**: Fun, colorful UI with gaming aesthetics
- 🔑 **Dev Key Protection**: Only accessible with your secret dev key
- 👥 **Real User Data**: Fetches actual users from your Clerk account
- 🖼️ **Profile Images**: Shows user profile pictures from Clerk
- 🎯 **Role Assignment**: Instantly assign admin or carrier roles
- 📊 **Live Stats**: See counts of admins, carriers, and total users
- 🔍 **Search**: Find users by email or name
- 🔄 **Refresh**: Reload users from Clerk API
- 📅 **Last Seen**: Shows when users last signed in
- 🎨 **Accent Color Integration**: Uses your selected accent color

## Security

- The dev key is the only protection - keep it secret!
- No Clerk authentication required - works from any account
- All role changes are logged in the database
- Accessible from anywhere as long as you have the dev key

## Default Dev Key

If you don't set `DEV_ADMIN_KEY`, it defaults to: `nova-dev-2024-admin-key`

**Change this immediately in production!**

## API Endpoints

- `POST /api/dev-admin/verify-key` - Verify dev key
- `GET /api/dev-admin/users` - Get all users
- `POST /api/dev-admin/assign-role` - Assign role to user

## Database

Uses the existing `user_roles` table:
- `user_id` - Clerk user ID
- `role` - "admin" or "carrier"
- `created_at` - When role was assigned
- `updated_at` - When role was last updated
