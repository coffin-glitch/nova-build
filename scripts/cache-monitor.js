#!/usr/bin/env node

/**
 * 🕵️ Next.js Cache Monitor
 * Monitors cache sizes and warns when they get too large
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIRS = [
  '.next',
  'node_modules/.cache'
];

const WARNING_THRESHOLD = 100 * 1024 * 1024; // 100MB

function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  
  let size = 0;
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += stat.size;
    }
  }
  
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkCaches() {
  console.log('🕵️ Next.js Cache Monitor');
  console.log('========================\n');
  
  let totalSize = 0;
  let hasWarnings = false;
  
  for (const dir of CACHE_DIRS) {
    const size = getDirSize(dir);
    totalSize += size;
    
    const status = size > WARNING_THRESHOLD ? '⚠️  WARNING' : '✅ OK';
    const warning = size > WARNING_THRESHOLD ? ' (Consider cleaning)' : '';
    
    console.log(`${status} ${dir}: ${formatBytes(size)}${warning}`);
    
    if (size > WARNING_THRESHOLD) {
      hasWarnings = true;
    }
  }
  
  console.log(`\n📊 Total cache size: ${formatBytes(totalSize)}`);
  
  if (hasWarnings) {
    console.log('\n🧹 Recommendation: Run "npm run clean" to clear caches');
  } else {
    console.log('\n✨ Cache sizes look good!');
  }
  
  return hasWarnings;
}

// Run the check
const hasWarnings = checkCaches();
process.exit(hasWarnings ? 1 : 0);
