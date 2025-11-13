#!/usr/bin/env tsx
/**
 * Fast TypeScript type checker for specific files
 * Usage: tsx scripts/type-check-fast.ts <file1> <file2> ...
 * Or: tsx scripts/type-check-fast.ts (checks all TypeScript files)
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

function findTsFiles(dir: string, ignore: string[] = []): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (ignore.some(ig => fullPath.includes(ig))) continue;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findTsFiles(fullPath, ignore));
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
  return files;
}

const files = process.argv.slice(2);

if (files.length === 0) {
  // Check all TypeScript files
  const tsFiles = findTsFiles(process.cwd(), ['node_modules', '.next', 'dist']);
  
  console.log(`Checking ${tsFiles.length} TypeScript files...`);
  const startTime = Date.now();
  
  try {
    execSync(`tsc --noEmit --skipLibCheck ${tsFiles.join(' ')}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Type check passed in ${duration.toFixed(2)}s`);
    process.exit(0);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`\n❌ Type check failed in ${duration.toFixed(2)}s`);
    process.exit(1);
  }
} else {
  // Check specific files
  console.log(`Checking ${files.length} file(s)...`);
  const startTime = Date.now();
  
  try {
    execSync(`tsc --noEmit --skipLibCheck ${files.join(' ')}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Type check passed in ${duration.toFixed(2)}s`);
    process.exit(0);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`\n❌ Type check failed in ${duration.toFixed(2)}s`);
    process.exit(1);
  }
}

