#!/bin/bash

# Update the DATABASE_URL in .env.local to use SQLite
echo "Updating DATABASE_URL to use local SQLite database..."

# Create a backup of the current .env.local
cp .env.local .env.local.backup

# Update the DATABASE_URL
sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=sqlite://./storage/nova-build.db|' .env.local

echo "✅ Updated DATABASE_URL to use local SQLite database"
echo "📁 Database file: ./storage/nova-build.db"
echo "🔄 Please restart the development server"
