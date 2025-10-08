#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DevHealthCheck {
  constructor() {
    this.projectRoot = process.cwd();
    this.issues = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  checkFileExists(filePath, description) {
    const fullPath = path.join(this.projectRoot, filePath);
    if (fs.existsSync(fullPath)) {
      this.log(`${description}: Found`);
      return true;
    } else {
      this.log(`${description}: Missing`, 'error');
      this.issues.push(`Missing ${description}`);
      return false;
    }
  }

  checkDirectoryExists(dirPath, description) {
    const fullPath = path.join(this.projectRoot, dirPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      this.log(`${description}: Found`);
      return true;
    } else {
      this.log(`${description}: Missing`, 'warn');
      this.warnings.push(`Missing ${description}`);
      return false;
    }
  }

  checkPortAvailability(port) {
    try {
      execSync(`lsof -ti:${port}`, { stdio: 'ignore' });
      this.log(`Port ${port}: In use`, 'warn');
      this.warnings.push(`Port ${port} is already in use`);
      return false;
    } catch (e) {
      this.log(`Port ${port}: Available`);
      return true;
    }
  }

  checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
      this.log(`Node.js version: ${nodeVersion} (Compatible)`);
      return true;
    } else {
      this.log(`Node.js version: ${nodeVersion} (Incompatible - requires 18+)`, 'error');
      this.issues.push('Node.js version too old');
      return false;
    }
  }

  checkPackageJson() {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      this.log('package.json: Missing', 'error');
      this.issues.push('Missing package.json');
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check for required dependencies
      const requiredDeps = ['next', 'react', 'react-dom'];
      const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
      
      if (missingDeps.length > 0) {
        this.log(`Missing dependencies: ${missingDeps.join(', ')}`, 'error');
        this.issues.push(`Missing dependencies: ${missingDeps.join(', ')}`);
        return false;
      }

      this.log('package.json: Valid');
      return true;
    } catch (error) {
      this.log(`package.json: Invalid JSON - ${error.message}`, 'error');
      this.issues.push('Invalid package.json');
      return false;
    }
  }

  checkNextConfig() {
    const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
    const foundConfig = configFiles.find(file => 
      fs.existsSync(path.join(this.projectRoot, file))
    );

    if (foundConfig) {
      this.log(`Next.js config: Found (${foundConfig})`);
      return true;
    } else {
      this.log('Next.js config: Missing', 'warn');
      this.warnings.push('No Next.js config file found');
      return false;
    }
  }

  checkCacheDirectories() {
    const cacheDirs = ['.next', 'node_modules/.cache'];
    let hasCacheIssues = false;

    for (const dir of cacheDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            this.log(`Cache directory ${dir}: Exists`);
          } else {
            this.log(`Cache directory ${dir}: Exists but not a directory`, 'warn');
            this.warnings.push(`${dir} exists but is not a directory`);
            hasCacheIssues = true;
          }
        } catch (error) {
          this.log(`Cache directory ${dir}: Error accessing - ${error.message}`, 'error');
          this.issues.push(`Cannot access ${dir}`);
          hasCacheIssues = true;
        }
      } else {
        this.log(`Cache directory ${dir}: Does not exist (OK)`);
      }
    }

    return !hasCacheIssues;
  }

  checkDatabaseFile() {
    const dbPath = path.join(this.projectRoot, 'storage', 'nova-build.db');
    if (fs.existsSync(dbPath)) {
      this.log('Database file: Found');
      return true;
    } else {
      this.log('Database file: Missing', 'warn');
      this.warnings.push('Database file not found - will be created on first run');
      return false;
    }
  }

  checkEnvironmentVariables() {
    const envFile = path.join(this.projectRoot, '.env.local');
    if (fs.existsSync(envFile)) {
      this.log('Environment file: Found');
      return true;
    } else {
      this.log('Environment file: Missing', 'warn');
      this.warnings.push('No .env.local file found');
      return false;
    }
  }

  async runFullCheck() {
    console.log('🔍 Running comprehensive development environment health check...\n');

    // Core checks
    this.checkNodeVersion();
    this.checkPackageJson();
    this.checkNextConfig();
    
    // File system checks
    this.checkFileExists('app/layout.tsx', 'App layout');
    this.checkFileExists('app/page.tsx', 'Home page');
    this.checkDirectoryExists('app', 'App directory');
    this.checkDirectoryExists('components', 'Components directory');
    this.checkDirectoryExists('lib', 'Lib directory');
    
    // Development environment checks
    this.checkPortAvailability(3000);
    this.checkCacheDirectories();
    this.checkDatabaseFile();
    this.checkEnvironmentVariables();

    // Summary
    console.log('\n📊 Health Check Summary:');
    console.log(`✅ Issues: ${this.issues.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);

    if (this.issues.length > 0) {
      console.log('\n❌ Critical Issues:');
      this.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('\n🎉 All checks passed! Your development environment is healthy.');
    } else if (this.issues.length === 0) {
      console.log('\n✅ No critical issues found. Warnings are non-blocking.');
    } else {
      console.log('\n🚨 Critical issues found. Please resolve them before continuing.');
    }

    return this.issues.length === 0;
  }
}

// CLI interface
if (require.main === module) {
  const healthCheck = new DevHealthCheck();
  healthCheck.runFullCheck().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = DevHealthCheck;
