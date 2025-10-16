# PostgreSQL Database Setup - NOVA Build

## 🎯 **IMPORTANT: PostgreSQL Only**

This application uses **PostgreSQL exclusively**. SQLite is NOT supported and should not be used.

## 📋 Database Configuration

### Environment Variables
```bash
# Required in .env.local
DATABASE_URL=postgresql://dukeisaac@localhost:5432/nova_build
```

### Database Connection
- **Host**: localhost
- **Port**: 5432
- **Database**: nova_build
- **User**: dukeisaac (or postgres)

## 🚀 Setup Instructions

### 1. Install PostgreSQL
```bash
# macOS with Homebrew
brew install postgresql@14
brew services start postgresql@14

# Fix linking issues if needed
brew unlink libpq
brew link --overwrite postgresql@14
```

### 2. Create Database
```bash
createdb nova_build
```

### 3. Apply Schema
```bash
psql -d nova_build -f db/migrations/012_complete_postgres_schema.sql
```

### 4. Verify Setup
```bash
psql "$DATABASE_URL" -c "\dt"
```

## 📊 Database Schema

### Core Tables
- **`loads`** - Main load data
- **`telegram_bids`** - Bid board functionality
- **`carrier_bids`** - Carrier bidding system
- **`carrier_profiles`** - Carrier management
- **`load_offers`** - Load offer system
- **`user_roles`** - Role management
- **`user_roles_cache`** - Role caching
- **`eax_loads_raw`** - EAX data import
- **`load_lifecycle_events`** - Load tracking
- **`offer_history`** - Offer tracking

### Messaging System
- **`conversations`** - Message conversations
- **`conversation_messages`** - Individual messages
- **`message_reads`** - Read receipts

### Additional Tables
- **`admin_messages`** - Admin messages
- **`carrier_chat_messages`** - Carrier chat
- **`notifications`** - System notifications
- **`offer_comments`** - Offer comments
- **`assignments`** - Load assignments
- **`dedicated_lanes`** - Dedicated lanes

## 🔧 API Route Configuration

### Database Imports
All API routes MUST use:
```typescript
import sql from "@/lib/db";  // PostgreSQL connection
```

### ❌ DO NOT USE
```typescript
import sql from "@/lib/db.server";  // SQLite - DEPRECATED
import sql from "@/lib/db-local";    // SQLite - DEPRECATED
```

### Query Syntax
Use PostgreSQL syntax:
```sql
-- ✅ Correct
SELECT * FROM telegram_bids WHERE published = true;

-- ❌ Wrong (SQLite syntax)
SELECT * FROM telegram_bids WHERE published = 1;
```

## 🛠️ Development Commands

### Start PostgreSQL Service
```bash
brew services start postgresql@14
```

### Stop PostgreSQL Service
```bash
brew services stop postgresql@14
```

### Connect to Database
```bash
psql "$DATABASE_URL"
```

### Run Migrations
```bash
psql -d nova_build -f db/migrations/[migration_file].sql
```

### Backup Database
```bash
pg_dump "$DATABASE_URL" > backup.sql
```

### Restore Database
```bash
psql "$DATABASE_URL" < backup.sql
```

## 🔍 Troubleshooting

### Connection Issues
1. **Check PostgreSQL is running**:
   ```bash
   brew services list | grep postgresql
   ```

2. **Verify DATABASE_URL**:
   ```bash
   echo $DATABASE_URL
   ```

3. **Test connection**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

### Common Errors
- **"database does not exist"**: Run `createdb nova_build`
- **"connection refused"**: Start PostgreSQL service
- **"permission denied"**: Check user permissions

### Reset Database
```bash
dropdb nova_build
createdb nova_build
psql -d nova_build -f db/migrations/012_complete_postgres_schema.sql
```

## 📝 Migration Management

### Current Migrations
- **`012_complete_postgres_schema.sql`** - Main schema
- **`023_create_proper_messaging_system.sql`** - Messaging system
- **`024_migrate_existing_messaging_data.sql`** - Data migration

### Archived Migrations
- **`db/migrations/archive/`** - Unused migrations
- **`004_offers_and_lanes.sql`** - Archived (unused tables)
- **`005_telegram_bids.sql`** - Archived (unused tables)
- **`007_assignments.sql`** - Archived (unused tables)
- **`009_assignments.sql`** - Archived (duplicate)

## 🚨 Important Notes

1. **PostgreSQL Only**: Never use SQLite for this application
2. **Schema Consistency**: All tables use UUID primary keys
3. **Extensions**: Requires `uuid-ossp` extension
4. **Indexes**: Proper indexes are created for performance
5. **Foreign Keys**: All relationships use proper foreign key constraints

## 🔄 Migration from SQLite

If migrating from SQLite:
1. Export data from SQLite
2. Transform data to PostgreSQL format
3. Import into PostgreSQL
4. Update all API routes to use PostgreSQL
5. Remove SQLite dependencies

## 📈 Performance

### Indexes Created
- Primary key indexes on all tables
- Foreign key indexes
- Search indexes on frequently queried columns
- Composite indexes for complex queries

### Query Optimization
- Use PostgreSQL-specific features
- Leverage JSONB for flexible data
- Use proper data types (UUID, TIMESTAMP WITH TIME ZONE)
- Utilize PostgreSQL's advanced indexing

## 🛡️ Security

### Connection Security
- Use environment variables for credentials
- Enable SSL in production
- Use connection pooling
- Implement proper user permissions

### Data Protection
- Use parameterized queries
- Implement proper validation
- Use PostgreSQL's built-in security features
- Regular backups and monitoring

---

**Remember**: This application is PostgreSQL-only. All development, testing, and production must use PostgreSQL.

