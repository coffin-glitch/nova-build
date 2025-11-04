/**
 * Script to help identify API routes still using Clerk
 * This will list all files that need migration
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

async function findClerkUsage() {
  const apiRoutesDir = path.join(process.cwd(), 'app', 'api');
  
  console.log('🔍 Scanning API routes for Clerk usage...\n');

  const files = await glob('**/*.ts', { cwd: apiRoutesDir, absolute: true });
  
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



