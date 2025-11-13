/**
 * Script to help identify API routes still using Clerk
 * This will list all files that need migration
 */

import * as fs from 'fs';
import * as path from 'path';

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findTsFiles(fullPath));
      } else if (entry.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return files;
}

async function findClerkUsage() {
  const apiRoutesDir = path.join(process.cwd(), 'app', 'api');
  
  console.log('🔍 Scanning API routes for Clerk usage...\n');

  const files = findTsFiles(apiRoutesDir);
  
  const clerkFiles: Array<{ file: string; lines: string[] }> = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    const clerkLines: string[] = [];
    let hasClerk = false;
    
    lines.forEach((line, index) => {
      if (
        line.includes('@clerk/nextjs') ||
        line.includes('from "@clerk') ||
        line.includes("from '@clerk") ||
        (line.includes('auth()') && content.includes('@clerk'))
      ) {
        hasClerk = true;
        clerkLines.push(`  Line ${index + 1}: ${line.trim()}`);
      }
    });
    
    if (hasClerk) {
      const relativePath = path.relative(process.cwd(), file);
      clerkFiles.push({ file: relativePath, lines: clerkLines });
    }
  }
  
  console.log(`📊 Found ${clerkFiles.length} API route files using Clerk:\n`);
  
  clerkFiles.forEach(({ file, lines }) => {
    console.log(`❌ ${file}`);
    lines.forEach(line => console.log(line));
    console.log('');
  });
  
  console.log('\n✅ Migration needed for these files');
  console.log('💡 Use requireApiAdmin, requireApiCarrier, or getApiAuth from @/lib/auth-api-helper');
}

findClerkUsage().catch(console.error);



