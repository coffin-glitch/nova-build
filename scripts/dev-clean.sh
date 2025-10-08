#!/bin/bash

# 🧹 Next.js Development Cache Cleaner
# This script helps prevent cache-related issues during development

echo "🧹 Next.js Development Cache Cleaner"
echo "=================================="

# Function to show usage
show_usage() {
    echo "Usage: ./scripts/dev-clean.sh [option]"
    echo ""
    echo "Options:"
    echo "  clean     - Clear .next and node_modules/.cache"
    echo "  reset     - Clear caches and restart dev server"
    echo "  fresh     - Nuclear option: clear everything and reinstall"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/dev-clean.sh clean"
    echo "  ./scripts/dev-clean.sh reset"
    echo "  ./scripts/dev-clean.sh fresh"
}

# Function to clean caches
clean_caches() {
    echo "🧹 Cleaning Next.js caches..."
    rm -rf .next
    rm -rf node_modules/.cache
    echo "✅ Caches cleared successfully!"
}

# Function to reset and restart
reset_dev() {
    echo "🔄 Resetting development environment..."
    clean_caches
    echo "🚀 Starting development server..."
    npm run dev
}

# Function for fresh start
fresh_start() {
    echo "💥 Fresh start - clearing everything..."
    rm -rf .next
    rm -rf node_modules/.cache
    rm -rf node_modules
    echo "📦 Reinstalling dependencies..."
    npm install
    echo "🚀 Starting development server..."
    npm run dev
}

# Main script logic
case "${1:-help}" in
    "clean")
        clean_caches
        ;;
    "reset")
        reset_dev
        ;;
    "fresh")
        fresh_start
        ;;
    "help"|*)
        show_usage
        ;;
esac
