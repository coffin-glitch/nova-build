#!/usr/bin/env node

/**
 * Development Cache Cleaner
 * Automatically clears caches when files change to prevent development issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DevCacheCleaner {
  constructor() {
    this.watchedFiles = new Set();
    this.watchedDirs = new Set();
    this.isWatching = false;
    this.debounceTimeout = null;
  }

  /**
   * Start watching for file changes
   */
  start() {
    if (this.isWatching) {
      console.log('🔄 Cache cleaner is already running');
      return;
    }

    console.log('🚀 Starting development cache cleaner...');
    
    // Watch common directories that affect caching
    const watchDirs = [
      'app',
      'components',
      'lib',
      'middleware.ts',
      'next.config.ts'
    ];

    watchDirs.forEach(dir => {
      const fullPath = path.resolve(dir);
      if (fs.existsSync(fullPath)) {
        this.watchDirectory(fullPath);
        this.watchedDirs.add(fullPath);
      }
    });

    this.isWatching = true;
    console.log('✅ Cache cleaner started');
  }

  /**
   * Watch a directory for changes
   */
  watchDirectory(dirPath) {
    try {
      fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (filename && this.shouldClearCache(filename)) {
          this.debouncedClearCache();
        }
      });
      console.log(`👀 Watching: ${dirPath}`);
    } catch (error) {
      console.log(`⚠️ Could not watch ${dirPath}:`, error.message);
    }
  }

  /**
   * Check if a file change should trigger cache clear
   */
  shouldClearCache(filename) {
    if (!filename) return false;
    
    const ext = path.extname(filename);
    const shouldWatch = [
      '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss'
    ].includes(ext);

    const isConfigFile = [
      'next.config.ts',
      'next.config.js',
      'middleware.ts',
      'tailwind.config.js',
      'tsconfig.json'
    ].includes(filename);

    return shouldWatch || isConfigFile;
  }

  /**
   * Debounced cache clearing to avoid excessive clearing
   */
  debouncedClearCache() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.clearCaches();
    }, 1000); // 1 second debounce
  }

  /**
   * Clear all development caches
   */
  clearCaches() {
    try {
      console.log('🧹 Clearing development caches...');
      
      // Clear Next.js cache
      if (fs.existsSync('.next')) {
        execSync('rm -rf .next', { stdio: 'inherit' });
        console.log('✅ Cleared .next cache');
      }

      // Clear node_modules cache
      if (fs.existsSync('node_modules/.cache')) {
        execSync('rm -rf node_modules/.cache', { stdio: 'inherit' });
        console.log('✅ Cleared node_modules/.cache');
      }

      // Clear TypeScript cache
      if (fs.existsSync('tsconfig.tsbuildinfo')) {
        fs.unlinkSync('tsconfig.tsbuildinfo');
        console.log('✅ Cleared TypeScript cache');
      }

      console.log('🎉 All caches cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing caches:', error.message);
    }
  }

  /**
   * Stop watching
   */
  stop() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.isWatching = false;
    console.log('⏹️ Cache cleaner stopped');
  }
}

// CLI interface
if (require.main === module) {
  const cleaner = new DevCacheCleaner();
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping cache cleaner...');
    cleaner.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 Stopping cache cleaner...');
    cleaner.stop();
    process.exit(0);
  });

  // Start watching
  cleaner.start();
}

module.exports = DevCacheCleaner;
