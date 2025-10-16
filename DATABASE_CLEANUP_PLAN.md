# Database Cleanup Plan

## Analysis Summary

### Current Database State
- **Database Type**: SQLite (storage/nova-build.db)
- **Total Tables**: 13 tables
- **Used Tables**: 10 tables
- **Unused Tables**: 3 tables
- **Unused Fields**: Multiple fields in loads table

## Tables to Remove (Safe to Delete)

### 1. `assignments` Table
- **Status**: Completely unused
- **References**: 0 in codebase
- **Migration**: Created in 007_assignments.sql
- **Action**: DROP TABLE

### 2. `dedicated_lanes` Table  
- **Status**: Unused (page uses mock data)
- **References**: 0 database queries
- **Migration**: Created in 004_offers_and_lanes.sql
- **Action**: DROP TABLE

### 3. `telegram_bid_offers` Table
- **Status**: Completely unused
- **References**: 0 in codebase
- **Migration**: Created in 005_telegram_bids.sql
- **Action**: DROP TABLE

## Fields to Remove from `loads` Table

### Unused Financial Fields
- `purchase` - Not used in any queries
- `net` - Not used in any queries  
- `margin` - Not used in any queries
- `purch_tr` - Duplicate/legacy field
- `net_mrg` - Duplicate/legacy field
- `cm` - Unused field

### Unused Vendor Fields
- `vendor_name` - Not used in carrier queries
- `dispatcher_name` - Not used in carrier queries

### Unused Audit Fields
- `docs_scanned` - Not used anywhere
- `invoice_date` - Not used anywhere
- `invoice_audit` - Not used anywhere

### Duplicate Fields
- `nbr_of_stops` - Duplicate of `stops` field

## Migration Cleanup

### Redundant Migrations to Remove
- `004_offers_and_lanes.sql` - Contains unused dedicated_lanes
- `005_telegram_bids.sql` - Contains unused telegram_bid_offers
- `007_assignments.sql` - Contains unused assignments table
- `009_assignments.sql` - Duplicate assignments migration

### Migrations to Keep
- `001_create_eax_tables.sql` - Core loads table
- `002_add_published_to_loads.sql` - Used field
- `006_*` migrations - Used tables
- `012_complete_postgres_schema.sql` - Comprehensive schema
- `023_create_proper_messaging_system.sql` - New messaging system
- `024_migrate_existing_messaging_data.sql` - Data migration

## Cleanup Steps

### Step 1: Backup Current Database
```bash
cp storage/nova-build.db storage/nova-build.db.backup
```

### Step 2: Remove Unused Tables
```sql
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS dedicated_lanes;
DROP TABLE IF EXISTS telegram_bid_offers;
```

### Step 3: Remove Unused Fields from loads Table
```sql
-- Remove unused financial fields
ALTER TABLE loads DROP COLUMN purchase;
ALTER TABLE loads DROP COLUMN net;
ALTER TABLE loads DROP COLUMN margin;
ALTER TABLE loads DROP COLUMN purch_tr;
ALTER TABLE loads DROP COLUMN net_mrg;
ALTER TABLE loads DROP COLUMN cm;

-- Remove unused vendor fields
ALTER TABLE loads DROP COLUMN vendor_name;
ALTER TABLE loads DROP COLUMN dispatcher_name;

-- Remove unused audit fields
ALTER TABLE loads DROP COLUMN docs_scanned;
ALTER TABLE loads DROP COLUMN invoice_date;
ALTER TABLE loads DROP COLUMN invoice_audit;

-- Remove duplicate fields
ALTER TABLE loads DROP COLUMN nbr_of_stops;
```

### Step 4: Clean Up Migration Files
- Move unused migrations to `db/migrations/archive/`
- Keep only essential migrations

### Step 5: Update Database Schema Files
- Update `lib/db-local.ts` to remove unused table creation
- Update `lib/db.server.ts` to remove unused table creation
- Remove unused table definitions

### Step 6: Verify Build
- Test all API endpoints
- Verify bid board functionality
- Check carrier and admin interfaces
- Ensure no broken queries

## Expected Benefits

### Performance Improvements
- Reduced database size
- Faster queries (fewer columns to scan)
- Reduced memory usage
- Cleaner schema

### Maintenance Benefits
- Easier to understand schema
- Fewer migration files to maintain
- Reduced confusion about unused fields
- Cleaner codebase

### Storage Savings
- Estimated 20-30% reduction in database size
- Fewer indexes to maintain
- Cleaner backup files

## Risk Assessment

### Low Risk
- Removing completely unused tables
- Removing fields with 0 references

### Medium Risk  
- Removing fields that might be used in future features
- Schema changes require careful testing

### Mitigation
- Full database backup before changes
- Comprehensive testing after cleanup
- Gradual rollout of changes
- Rollback plan if issues arise

## Testing Checklist

- [ ] All API endpoints respond correctly
- [ ] Bid board loads and functions properly
- [ ] Carrier interface works correctly
- [ ] Admin interface functions properly
- [ ] Load management works correctly
- [ ] User roles function correctly
- [ ] Database queries execute without errors
- [ ] No broken references in code

