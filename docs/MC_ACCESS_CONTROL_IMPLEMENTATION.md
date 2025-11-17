# MC Access Control System - Implementation Summary

## Overview
A central control system that allows admins to enable/disable access for carriers by MC number. When an MC is disabled, all carriers with that MC automatically lose access and are set to "Declined" status.

## Features

### 1. **Main Control Button**
- Located in the Carrier Health Console
- Opens the MC Access Control Console
- Purple/indigo gradient styling

### 2. **MC Access Control Console**
- Lists all MCs with their access states
- Toggle switches (Blue = Active, Red = Disabled)
- Search functionality
- Shows carrier count per MC
- Displays disabled reason and timestamp

### 3. **Automatic Profile Management**
- When MC is disabled → All carriers with that MC are set to "Declined"
- When MC is enabled → Carriers declined due to MC disable are reset to "Pending"
- Database trigger handles automatic updates

### 4. **Signup Blocking**
- New signups with disabled MCs are blocked
- Error message: "Your MC number (XXX) is not allowed access to the bid board. DNU by USPS. Please contact support if you believe this is an error."

### 5. **Middleware Protection**
- Checks MC access status on every request
- Automatically updates profile status if MC becomes disabled
- Redirects to declined page with reason

## Database Schema

### Table: `mc_access_control`
```sql
- id: UUID (primary key)
- mc_number: TEXT (unique, indexed)
- is_active: BOOLEAN (default: true)
- disabled_reason: TEXT (default: 'DNU by USPS')
- disabled_by: TEXT (admin user_id)
- disabled_at: TIMESTAMP
- enabled_by: TEXT (admin user_id)
- enabled_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Triggers
1. **Auto-update `updated_at`** when record changes
2. **Auto-disable carriers** when MC is disabled
3. **Auto-reset carriers** when MC is enabled (if declined due to MC disable)

## API Endpoints

### GET `/api/admin/mc-access-control`
- Get all MC access control states
- Query param `?mc=XXXXX` to get specific MC
- Returns active state (defaults to `true` if not in table)

### POST `/api/admin/mc-access-control`
- Create or update MC access control
- Body: `{ mc_number, is_active, disabled_reason }`
- Automatically triggers carrier profile updates

## Files Created/Modified

### Created:
1. `db/migrations/113_mc_access_control.sql` - Database schema
2. `app/api/admin/mc-access-control/route.ts` - API endpoints
3. `components/admin/MCAccessControlConsole.tsx` - UI component
4. `scripts/run-mc-access-control-migration.ts` - Migration script

### Modified:
1. `components/admin/CarrierHealthConsole.tsx` - Added Main Control button
2. `app/api/carrier/profile/route.ts` - Added MC check on signup
3. `middleware.ts` - Added MC access check for existing users

## Usage

### Running the Migration
```bash
tsx scripts/run-mc-access-control-migration.ts
```

### Accessing Main Control
1. Open Carrier Health Console for any MC
2. Click "Main Control" button
3. Toggle MC access states
4. Search for specific MCs

### Default Behavior
- **All MCs are active by default** (no entry in table = active)
- Only disabled MCs are stored in the table
- When enabled, entry can remain or be removed (both work)

## Security

- Admin-only access (requires `requireApiAdmin`)
- Automatic profile status updates via database triggers
- Middleware checks on every request
- Signup blocking prevents new registrations with disabled MCs

## User Experience

### For Disabled MCs:
- Profile status automatically set to "Declined"
- Redirected to profile page with decline message
- Cannot access bid board or other carrier functions
- Clear error message on signup attempts

### For Admins:
- Central control panel for all MCs
- Visual indicators (Blue/Red)
- Search and filter capabilities
- Carrier count per MC
- Timestamps and admin tracking

