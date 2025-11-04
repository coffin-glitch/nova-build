-- Script to verify database is ready for clerk_user_id removal
-- Run this BEFORE running migration 078

-- 1. Check if all critical tables have supabase_user_id
SELECT 
  'Tables with supabase_user_id' as check_type,
  COUNT(DISTINCT table_name) as count
FROM information_schema.columns
WHERE column_name = 'supabase_user_id'
AND table_schema = 'public';

-- 2. List tables that still have clerk_user_id
SELECT 
  'Tables with clerk_user_id' as check_type,
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE column_name LIKE '%clerk%'
AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 3. Check for data that only has clerk_user_id (no supabase_user_id)
-- This would be problematic
SELECT 
  'carrier_profiles: rows with only clerk_user_id' as check_type,
  COUNT(*) as count
FROM carrier_profiles
WHERE supabase_user_id IS NULL
AND clerk_user_id IS NOT NULL
UNION ALL
SELECT 
  'carrier_bids: rows with only clerk_user_id',
  COUNT(*)
FROM carrier_bids
WHERE supabase_user_id IS NULL
AND clerk_user_id IS NOT NULL
UNION ALL
SELECT 
  'user_roles_cache: rows with only clerk_user_id',
  COUNT(*)
FROM user_roles_cache
WHERE supabase_user_id IS NULL
AND clerk_user_id IS NOT NULL;

-- 4. Verify no active data depends on clerk_user_id
SELECT 
  'Summary: Ready for migration?' as check_type,
  CASE 
    WHEN (
      SELECT COUNT(*) FROM carrier_profiles 
      WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL
    ) = 0 
    AND (
      SELECT COUNT(*) FROM carrier_bids 
      WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL
    ) = 0
    AND (
      SELECT COUNT(*) FROM user_roles_cache 
      WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL
    ) = 0
    THEN '✅ YES - All data has supabase_user_id'
    ELSE '❌ NO - Some data only has clerk_user_id'
  END as status;

