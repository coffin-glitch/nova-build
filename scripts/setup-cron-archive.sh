#!/bin/bash
# Setup cron job for notification logs archival
# This script adds a daily cron job to run the archival script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ARCHIVE_SCRIPT="$SCRIPT_DIR/archive-notification-logs.ts"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Setup Cron Job for Notification Logs Archival               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js not found. Please install Node.js first."
  exit 1
fi

# Check if tsx is available
if ! command -v tsx &> /dev/null && ! command -v npx &> /dev/null; then
  echo "❌ Error: tsx not found. Installing tsx..."
  npm install -g tsx || {
    echo "⚠️  Could not install tsx globally. Will use npx instead."
  }
fi

# Determine the command to run
if command -v tsx &> /dev/null; then
  RUNNER="tsx"
else
  RUNNER="npx tsx"
fi

# Create cron job entry (runs daily at 2 AM)
CRON_TIME="0 2 * * *"
CRON_ENTRY="$CRON_TIME cd $PROJECT_DIR && $RUNNER $ARCHIVE_SCRIPT >> $PROJECT_DIR/logs/archive-notifications.log 2>&1"

echo "📋 Cron job configuration:"
echo "   Time: Daily at 2:00 AM"
echo "   Script: $ARCHIVE_SCRIPT"
echo "   Log: $PROJECT_DIR/logs/archive-notifications.log"
echo ""

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "archive-notification-logs.ts"; then
  echo "⚠️  Cron job already exists. Updating..."
  # Remove existing entry
  crontab -l 2>/dev/null | grep -v "archive-notification-logs.ts" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job added successfully!"
echo ""
echo "📝 Current crontab:"
crontab -l | grep "archive-notification-logs" || echo "   (not found - this shouldn't happen)"
echo ""
echo "💡 To view all cron jobs: crontab -l"
echo "💡 To remove this cron job: crontab -e (then delete the line)"
echo "💡 To test the script manually: cd $PROJECT_DIR && $RUNNER $ARCHIVE_SCRIPT"
echo ""

