#!/bin/bash
# Script to find all remaining clerk_user_id references

echo "🔍 Scanning for remaining clerk_user_id references..."
echo ""

echo "=== API Routes ==="
grep -rn "clerk_user_id\|clerkUserId" --include="*.ts" --include="*.tsx" app/api 2>/dev/null | grep -v "node_modules" | grep -v ".next" | wc -l

echo ""
echo "=== Library Files ==="
grep -rn "clerk_user_id\|clerkUserId" --include="*.ts" lib 2>/dev/null | grep -v "node_modules" | wc -l

echo ""
echo "=== Database Migrations ==="
grep -rn "clerk_user_id" db/migrations 2>/dev/null | wc -l

echo ""
echo "=== Type Definitions ==="
grep -rn "clerk_user_id\|clerkUserId" --include="*.ts" lib/types.ts lib/schema.ts 2>/dev/null | wc -l

