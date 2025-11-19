# Database Migrations Explained

## What Are Database Migrations?

Database migrations are SQL scripts that **create and modify your database structure** (tables, columns, indexes, functions, etc.) in a controlled, versioned way. Think of them as blueprints that build your database from scratch or update it step-by-step.

## Why Run Migrations?

Your application needs a database with specific tables and structure to work. Without running migrations, your database is empty and the app won't function. Migrations ensure:
- ✅ All required tables exist
- ✅ Tables have the correct columns and data types
- ✅ Relationships between tables are set up (foreign keys)
- ✅ Indexes are created for performance
- ✅ Database functions and triggers are configured

---

## Migration Overview by Category

### 🏗️ **Core Schema (Migration 012)**
**File**: `012_complete_postgres_schema.sql`

This is the **foundation migration** - it creates all the essential tables:

#### **User Management Tables**
- **`user_roles`** - Stores user roles (admin/carrier) - legacy support
- **`user_roles_cache`** - Centralized user role cache with email and sync info
- **`carrier_profiles`** - Carrier company information (MC#, DOT#, phone, email, etc.)

#### **Bidding & Loads Tables**
- **`telegram_bids`** - Real-time bids from Telegram (bid numbers, pickup/delivery times, distance, etc.)
- **`loads`** - Load data from EAX system (origin, destination, revenue, margin, equipment, etc.)
- **`telegram_bid_offers`** - Carrier offers on Telegram bids
- **`load_offers`** - Carrier offers on loads (status: pending/accepted/rejected/countered)
- **`carrier_bids`** - Carrier bid submissions with amounts and notes

#### **Assignment & Tracking Tables**
- **`assignments`** - Load assignments to carriers (status: assigned/picked_up/delivered/cancelled)

#### **Communication Tables**
- **`carrier_chat_messages`** - Messages from carriers
- **`admin_messages`** - Messages from admins to carriers

#### **Other Tables**
- **`dedicated_lanes`** - Information about dedicated shipping lanes

**What it does**: Creates ~12 core tables with proper relationships, constraints, and indexes.

---

### 🔔 **Notifications System (Migration 010+)**
**Files**: `010_notifications.sql`, `044_add_advanced_notification_preferences.sql`, etc.

Creates the notification system:
- **`notifications`** - User notifications (offer accepted, new bid, etc.)
- **`carrier_notification_preferences`** - User preferences for notification types
- **`notification_triggers`** - Automated notification triggers
- **`notification_logs`** - Logs of sent notifications

**What it does**: Enables the app to send and track notifications to users.

---

### 💬 **Messaging System (Migrations 011, 023, 050+)**
**Files**: `011_carrier_chat_messages.sql`, `023_create_proper_messaging_system.sql`, `050_create_bid_messages_table.sql`

Creates a full messaging system:
- **`conversations`** - Conversation threads between admins and carriers
- **`conversation_messages`** - Individual messages in conversations
- **`message_reads`** - Tracks which messages have been read
- **`bid_messages`** - Messages related to specific bids

**What it does**: Enables real-time messaging between admins and carriers.

---

### 🚚 **Driver & Load Management (Migrations 023, 025, 026+)**
**Files**: `023_create_driver_profiles.sql`, `025_enhance_multi_carrier_driver_support.sql`, `026_add_lifecycle_statuses_to_load_offers.sql`

Adds driver and load tracking:
- **`driver_profiles`** - Driver information (name, license, etc.)
- Enhanced **`load_offers`** with driver info and lifecycle statuses
- Time tracking columns (pickup time, departure time, check-in time, delivery time)

**What it does**: Tracks drivers assigned to loads and load lifecycle events.

---

### 🏆 **Auction & Bidding System (Migration 006+)**
**File**: `006_auctions_and_bidding.sql`

Creates auction functionality:
- **`auction_awards`** - Records of which carrier won which bid
- Bid lifecycle tracking

**What it does**: Manages the bidding/auction process for loads.

---

### 🔄 **Supabase Migration (Migrations 053, 076-081)**
**Files**: `053_add_supabase_user_id_columns.sql`, `081_recreate_user_roles_supabase.sql`

**Important**: This app migrated from Clerk to Supabase authentication.

What these do:
- Adds `supabase_user_id` columns to all tables (for Supabase auth)
- Makes `clerk_user_id` nullable (backward compatibility)
- Recreates `user_roles` table to work with Supabase
- Creates mapping views for user ID lookups

**What it does**: Enables the app to use Supabase authentication instead of Clerk.

---

### ⭐ **Favorites System (Migration 033)**
**File**: `033_carrier_favorites_system.sql`

Creates:
- **`carrier_favorites`** - Allows carriers to favorite/save bids

**What it does**: Lets carriers bookmark bids they're interested in.

---

### 📊 **Bid Archival System (Migrations 034-039)**
**Files**: `034_bid_archival_system.sql`, `038_end_of_day_archiving.sql`, `039_schedule_end_of_day_archiving.sql`

Creates automated bid archiving:
- **`archived_bids`** - Stores expired/old bids
- Functions to automatically archive bids at end of day
- Scheduled jobs for archiving

**What it does**: Automatically moves old/expired bids to archive to keep the database clean.

---

### 🤖 **AI Assistant (Migrations 111-112)**
**Files**: `111_ai_assistant_conversations.sql`, `112_ai_assistant_advanced_memory.sql`

Creates AI assistant features:
- **`ai_assistant_conversations`** - Conversation sessions
- **`ai_assistant_messages`** - Messages in conversations
- Memory storage for AI context

**What it does**: Enables AI assistant features for admins.

---

### 🏥 **Carrier Health Data (Migration 108-110)**
**Files**: `108_highway_carrier_data.sql`, `109_highway_user_cookies.sql`, `110_carrier_health_data.sql`

Creates carrier health tracking:
- **`highway_carrier_data`** - Data from Highway API
- **`highway_user_cookies`** - Authentication cookies for Highway API
- **`carrier_health_data`** - Health scores and status

**What it does**: Tracks carrier safety/health scores from external APIs.

---

### 📄 **Documents & Attachments (Migrations 084-085)**
**Files**: `084_create_bid_documents.sql`, `085_add_attachments_to_conversation_messages.sql`

Adds file/document support:
- **`bid_documents`** - Documents attached to bids
- Attachment support in conversation messages

**What it does**: Allows users to attach files to bids and messages.

---

## Migration Order & Dependencies

Migrations are numbered (001, 002, 003...) and should be run **in order** because:
1. Later migrations may depend on tables created in earlier ones
2. Some migrations modify existing tables (add columns, indexes)
3. Running out of order can cause errors

### Critical Path:
1. **012** - Core schema (MUST RUN FIRST)
2. **010** - Notifications
3. **011** - Chat messages
4. **053** - Supabase user IDs (if using Supabase auth)
5. **081** - Supabase user roles
6. Then all others in numerical order

---

## What Happens When You Run Migrations?

### ✅ **Safe Operations** (Most migrations use these)
- `CREATE TABLE IF NOT EXISTS` - Only creates if table doesn't exist
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` - Only adds if column doesn't exist
- `CREATE INDEX IF NOT EXISTS` - Only creates if index doesn't exist

**Result**: Running migrations multiple times is usually safe - they won't break existing data.

### ⚠️ **Potentially Destructive Operations** (Rare)
- `DROP TABLE` - Deletes a table (data loss!)
- `ALTER TABLE ... DROP COLUMN` - Removes a column (data loss!)
- `TRUNCATE TABLE` - Empties a table (data loss!)

**Note**: Most migrations in this project are safe and use `IF NOT EXISTS` checks.

---

## Should You Run All Migrations?

### **For a Fresh Database (New Setup)**
✅ **YES** - Run all migrations in order (012, then 013, 014, etc.)

### **For an Existing Database**
⚠️ **BE CAREFUL** - Check which migrations have already been run. Running them again is usually safe (due to `IF NOT EXISTS`), but verify first.

---

## How to Run Migrations

### Option 1: Using Supabase SQL Editor (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste migration SQL
4. Run it

### Option 2: Using psql Command Line
```bash
# Run a single migration
psql $DATABASE_URL -f db/migrations/012_complete_postgres_schema.sql

# Run multiple migrations
for file in db/migrations/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

### Option 3: Using a Migration Tool
Some projects use tools like Drizzle ORM migrations, but this project uses raw SQL files.

---

## Summary

**Migrations create and configure your database structure.** They:
- ✅ Create tables for users, bids, loads, messages, etc.
- ✅ Set up relationships between tables
- ✅ Add indexes for performance
- ✅ Create functions and triggers for automation
- ✅ Add new features over time (notifications, AI, etc.)

**Before running**: Make sure you have:
- ✅ A Supabase database set up
- ✅ Your `DATABASE_URL` configured in `.env.local`
- ✅ Backed up any existing data (if applicable)

**After running**: Your database will be ready for the application to use!

---

## Questions?

If you're unsure about running a specific migration:
1. Read the migration file comments (they explain what it does)
2. Check if it uses `IF NOT EXISTS` (safe to re-run)
3. Test on a development database first
4. Backup your database before running migrations on production


