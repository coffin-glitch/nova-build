#!/usr/bin/env node

/**
 * Script to update all API routes to pass request parameter to addSecurityHeaders
 * for CORS support.
 * 
 * This script:
 * 1. Finds all occurrences of addSecurityHeaders(response) and 
 *    addRateLimitHeaders(addSecurityHeaders(response), rateLimit)
 * 2. Updates them to include the request parameter
 * 3. Verifies request is in scope
 * 4. Provides a detailed report
 * 
 * Usage:
 *   node scripts/update-cors-headers.js [--dry-run] [--test-files file1,file2]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run');
const TEST_FILES = process.argv.find(arg => arg.startsWith('--test-files'))?.split('=')[1]?.split(',') || null;

/**
 * Get the request parameter name from function signature
 */
function getRequestParamName(content) {
  const functionSignatureMatch = content.match(/export\s+async\s+function\s+\w+\s*\([^)]+\)/);
  if (functionSignatureMatch) {
    const paramMatch = functionSignatureMatch[0].match(/(\w+)\s*:\s*NextRequest/);
    if (paramMatch) {
      return paramMatch[1]; // Return the actual parameter name (req, request, etc.)
    }
  }
  // Default to 'request' if not found
  return 'request';
}

// Patterns to find and replace (will be customized per file)
function getPatterns(requestParamName) {
  return [
    {
      // Pattern 1: addSecurityHeaders(response)
      find: /addSecurityHeaders\(response\)/g,
      replace: `addSecurityHeaders(response, ${requestParamName})`,
      description: `addSecurityHeaders(response) -> addSecurityHeaders(response, ${requestParamName})`
    },
    {
      // Pattern 2: addRateLimitHeaders(addSecurityHeaders(response), rateLimit)
      find: /addRateLimitHeaders\(addSecurityHeaders\(response\),\s*rateLimit\)/g,
      replace: `addRateLimitHeaders(addSecurityHeaders(response, ${requestParamName}), rateLimit)`,
      description: `addRateLimitHeaders(addSecurityHeaders(response), rateLimit) -> addRateLimitHeaders(addSecurityHeaders(response, ${requestParamName}), rateLimit)`
    }
  ];
}

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  totalReplacements: 0,
  errors: [],
  skipped: []
};

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
  // Only process TypeScript route files
  if (!filePath.endsWith('/route.ts')) {
    return false;
  }
  
  // Skip if test files specified and this isn't one of them
  if (TEST_FILES) {
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    return TEST_FILES.some(testFile => 
      relativePath.includes(testFile) || 
      fileName === testFile || 
      filePath.includes(testFile)
    );
  }
  
  return true;
}

/**
 * Verify request is in scope (handles req, request, or any NextRequest parameter)
 */
function verifyRequestInScope(content, filePath) {
  // Find the NextRequest parameter name (could be req, request, etc.)
  const functionSignatureMatch = content.match(/export\s+async\s+function\s+\w+\s*\([^)]+\)/);
  if (!functionSignatureMatch) {
    return false;
  }
  
  // Extract parameter name that's a NextRequest
  const paramMatch = functionSignatureMatch[0].match(/(\w+)\s*:\s*NextRequest/);
  if (paramMatch) {
    const requestParamName = paramMatch[1];
    
    // Check if this parameter is used in addSecurityHeaders calls
    // We need to replace 'request' with the actual parameter name
    const hasSecurityHeadersCall = content.includes('addSecurityHeaders(response)');
    
    if (hasSecurityHeadersCall) {
      // The parameter exists, we just need to use it
      return true;
    }
  }
  
  // Fallback: check for common patterns
  const hasRequestParam = /(?:req|request)\s*:\s*NextRequest/.test(content);
  const hasRequestUsage = /(?:req|request)\.(?:url|headers|json|formData|nextUrl)/.test(content);
  
  return hasRequestParam || hasRequestUsage;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let replacements = 0;
    let newContent = content;
    
    // Skip if file doesn't import addSecurityHeaders
    if (!content.includes('addSecurityHeaders')) {
      return { modified: false, replacements: 0 };
    }
    
    // Verify request is in scope
    if (!verifyRequestInScope(content, filePath)) {
      stats.skipped.push({
        file: filePath,
        reason: 'Request parameter not found in scope'
      });
      return { modified: false, replacements: 0 };
    }
    
    // Get the actual request parameter name (req, request, etc.)
    const requestParamName = getRequestParamName(content);
    const patterns = getPatterns(requestParamName);
    
    // Apply all patterns
    for (const pattern of patterns) {
      const matches = newContent.match(pattern.find);
      if (matches) {
        const before = newContent;
        newContent = newContent.replace(pattern.find, pattern.replace);
        if (before !== newContent) {
          modified = true;
          replacements += matches.length;
        }
      }
    }
    
    // Write file if modified and not dry run
    if (modified && !DRY_RUN) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
    
    return { modified, replacements };
    
  } catch (error) {
    stats.errors.push({
      file: filePath,
      error: error.message
    });
    return { modified: false, replacements: 0 };
  }
}

/**
 * Find all route files
 */
function findRouteFiles(dir = 'app/api') {
  const files = [];
  
  function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name === 'route.ts') {
        if (shouldProcessFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  if (fs.existsSync(dir)) {
    walkDir(dir);
  }
  
  return files;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Finding API route files...\n');
  
  const files = findRouteFiles();
  console.log(`Found ${files.length} route files to process\n`);
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }
  
  if (TEST_FILES) {
    console.log(`🧪 TEST MODE - Only processing: ${TEST_FILES.join(', ')}\n`);
  }
  
  console.log('Processing files...\n');
  
  for (const file of files) {
    stats.filesProcessed++;
    const result = processFile(file);
    
    if (result.modified) {
      stats.filesModified++;
      stats.totalReplacements += result.replacements;
      console.log(`✅ ${file} - ${result.replacements} replacement(s)`);
    }
  }
  
  // Print report
  console.log('\n' + '='.repeat(60));
  console.log('📊 REPORT');
  console.log('='.repeat(60));
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Total replacements: ${stats.totalReplacements}`);
  console.log(`Skipped: ${stats.skipped.length}`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.skipped.length > 0) {
    console.log('\n⚠️  Skipped files:');
    stats.skipped.forEach(({ file, reason }) => {
      console.log(`   - ${file}: ${reason}`);
    });
  }
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
  }
  
  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply changes');
  } else if (stats.filesModified > 0) {
    console.log('\n✅ Changes applied successfully!');
    console.log('💡 Run: git diff to review changes');
    console.log('💡 Run: npm run lint to check for issues');
  }
  
  console.log('\n');
}

// Run the script
main();

