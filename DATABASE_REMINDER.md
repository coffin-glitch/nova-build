# DATABASE REMINDER - CRITICAL

## ⚠️ POSTGRESQL ONLY - NO SQLITE ⚠️

**The Nova Build application uses PostgreSQL as its primary database.**

### Key Points:
- **Primary Database**: PostgreSQL (configured in `lib/db.ts`)
- **Database Library**: `postgres` npm package
- **Connection**: Uses `DATABASE_URL` environment variable
- **Migrations**: Located in `db/migrations/` directory
- **Schema**: PostgreSQL-specific syntax and features

### What NOT to do:
- ❌ Never suggest SQLite solutions
- ❌ Don't modify `lib/db-local.ts` (it's legacy/unused)
- ❌ Don't use SQLite-specific syntax
- ❌ Don't suggest local SQLite database files

### What TO do:
- ✅ Always use PostgreSQL for database operations
- ✅ Use `lib/db.ts` for database connections
- ✅ Run PostgreSQL migrations from `db/migrations/`
- ✅ Use PostgreSQL-specific features and syntax
- ✅ Ensure `DATABASE_URL` points to PostgreSQL instance

### Database Connection:
```typescript
// lib/db.ts - This is the active database configuration
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ... });
```

### Migration Commands:
```bash
# Run PostgreSQL migrations
psql $DATABASE_URL -f db/migrations/[migration_file].sql
```

---
**This reminder should be consulted before any database-related work.**
