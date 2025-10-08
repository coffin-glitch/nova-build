#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class EnhancedCacheManager {
  constructor() {
    this.projectRoot = process.cwd();
    this.cacheDirs = [
      '.next',
      'node_modules/.cache',
      '.turbo',
      '.swc',
      'dist',
      'build'
    ];
    this.watchPatterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.json',
      '**/*.css',
      '**/*.scss',
      '**/*.md'
    ];
    this.isCleaning = false;
    this.lastCleanTime = 0;
    this.cleanCooldown = 5000; // 5 seconds between cleans
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async cleanCache(force = false) {
    if (this.isCleaning && !force) {
      this.log('Cache clean already in progress, skipping...', 'warn');
      return;
    }

    const now = Date.now();
    if (!force && now - this.lastCleanTime < this.cleanCooldown) {
      this.log('Cache clean cooldown active, skipping...', 'warn');
      return;
    }

    this.isCleaning = true;
    this.lastCleanTime = now;

    try {
      this.log('Starting enhanced cache cleanup...');
      
      // Kill any running Next.js processes
      try {
        execSync('pkill -f "next dev"', { stdio: 'ignore' });
        this.log('Killed existing Next.js processes');
      } catch (e) {
        // Ignore if no processes found
      }

      // Clean cache directories
      for (const dir of this.cacheDirs) {
        const fullPath = path.join(this.projectRoot, dir);
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          this.log(`Cleaned ${dir}`);
        }
      }

      // Clean TypeScript build info
      const tsBuildInfo = path.join(this.projectRoot, 'tsconfig.tsbuildinfo');
      if (fs.existsSync(tsBuildInfo)) {
        fs.unlinkSync(tsBuildInfo);
        this.log('Cleaned TypeScript build info');
      }

      // Clean ESLint cache
      const eslintCache = path.join(this.projectRoot, '.eslintcache');
      if (fs.existsSync(eslintCache)) {
        fs.unlinkSync(eslintCache);
        this.log('Cleaned ESLint cache');
      }

      // Clean any lock files that might cause issues
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
      for (const lockFile of lockFiles) {
        const lockPath = path.join(this.projectRoot, lockFile);
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
          this.log(`Cleaned ${lockFile}`);
        }
      }

      this.log('Enhanced cache cleanup completed successfully');
      
    } catch (error) {
      this.log(`Cache cleanup failed: ${error.message}`, 'error');
    } finally {
      this.isCleaning = false;
    }
  }

  async startDevServer() {
    this.log('Starting development server with enhanced cache management...');
    
    try {
      // Start the dev server
      const devProcess = execSync('npm run dev', { 
        stdio: 'inherit',
        cwd: this.projectRoot 
      });
    } catch (error) {
      this.log(`Failed to start dev server: ${error.message}`, 'error');
    }
  }

  async monitorAndClean() {
    this.log('Starting file monitoring for automatic cache cleaning...');
    
    // Monitor key files for changes
    const keyFiles = [
      'next.config.js',
      'next.config.mjs',
      'tailwind.config.js',
      'tsconfig.json',
      'package.json',
      'middleware.ts'
    ];

    for (const file of keyFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        fs.watchFile(filePath, { interval: 1000 }, () => {
          this.log(`Configuration file changed: ${file}`);
          this.cleanCache();
        });
      }
    }

    // Monitor for problematic patterns
    this.monitorProblematicPatterns();
  }

  monitorProblematicPatterns() {
    // Check for common issues that cause cache problems
    setInterval(() => {
      this.checkForIssues();
    }, 30000); // Check every 30 seconds
  }

  checkForIssues() {
    // Check for corrupted .next directory
    const nextDir = path.join(this.projectRoot, '.next');
    if (fs.existsSync(nextDir)) {
      const requiredFiles = [
        'routes-manifest.json',
        'pages-manifest.json',
        'next-font-manifest.json',
        'middleware-manifest.json'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(nextDir, file);
        if (!fs.existsSync(filePath)) {
          this.log(`Missing critical build file: ${file}, cleaning cache...`, 'warn');
          this.cleanCache();
          break;
        }
      }
    }
  }

  async healthCheck() {
    this.log('Performing development environment health check...');
    
    // Check if port 3000 is available
    try {
      const { execSync } = require('child_process');
      execSync('lsof -ti:3000', { stdio: 'ignore' });
      this.log('Port 3000 is in use', 'warn');
    } catch (e) {
      this.log('Port 3000 is available');
    }

    // Check for common issues
    const issues = [];
    
    if (!fs.existsSync(path.join(this.projectRoot, 'package.json'))) {
      issues.push('Missing package.json');
    }

    if (!fs.existsSync(path.join(this.projectRoot, 'next.config.js')) && 
        !fs.existsSync(path.join(this.projectRoot, 'next.config.mjs'))) {
      issues.push('Missing Next.js config file');
    }

    if (issues.length > 0) {
      this.log(`Health check issues found: ${issues.join(', ')}`, 'warn');
    } else {
      this.log('Health check passed');
    }
  }
}

// CLI interface
if (require.main === module) {
  const manager = new EnhancedCacheManager();
  const command = process.argv[2];

  switch (command) {
    case 'clean':
      manager.cleanCache(true);
      break;
    case 'dev':
      manager.cleanCache(true).then(() => manager.startDevServer());
      break;
    case 'monitor':
      manager.monitorAndClean();
      break;
    case 'health':
      manager.healthCheck();
      break;
    default:
      console.log(`
Enhanced Cache Manager

Usage:
  node scripts/enhanced-cache-manager.js <command>

Commands:
  clean    - Clean all caches
  dev      - Clean caches and start dev server
  monitor  - Start file monitoring
  health   - Run health check

Examples:
  node scripts/enhanced-cache-manager.js clean
  node scripts/enhanced-cache-manager.js dev
      `);
  }
}

module.exports = EnhancedCacheManager;
