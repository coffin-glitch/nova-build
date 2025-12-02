import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, resolve, dirname, basename } from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = process.cwd();

// Allowed directories for file access
const ALLOWED_PATHS = [
  'app/',
  'components/',
  'lib/',
  'db/',
  'scripts/',
  'hooks/',
  'types/',
  'public/',
  'middleware.ts',
  'next.config.ts',
  'package.json',
  'tsconfig.json',
];

// Blocked patterns (files/directories to never access)
const BLOCKED_PATTERNS = [
  '.env',
  'node_modules',
  '.next',
  '.git',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.DS_Store',
  'dist/',
  'build/',
  '.cache',
  'logs/',
  'backups/',
  'migration_backup/',
  'storage/eax-profile',
  'debug/',
];

// Blocked file extensions (heavy files that shouldn't be read)
const BLOCKED_EXTENSIONS = [
  '.log',
  '.sql',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg', // Can be large
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
];

/**
 * Check if a directory should be skipped during traversal
 */
function shouldSkipDir(dirName: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => 
    dirName.includes(pattern) || dirName === pattern.replace('/', '')
  );
}

/**
 * Check if a file should be skipped based on extension
 */
function shouldSkipFile(filePath: string): boolean {
  const ext = filePath.toLowerCase();
  return BLOCKED_EXTENSIONS.some(blockedExt => ext.endsWith(blockedExt));
}

// Maximum file size to read (50KB)
const MAX_FILE_SIZE = 50 * 1024;

/**
 * Validate that a file path is safe to read
 */
function validateFilePath(filePath: string): { valid: boolean; error?: string } {
  // Normalize path
  const normalizedPath = resolve(PROJECT_ROOT, filePath);
  const relativePath = relative(PROJECT_ROOT, normalizedPath);
  
  // Check for directory traversal
  if (relativePath.startsWith('..') || relativePath.includes('..')) {
    return { valid: false, error: "Path traversal not allowed" };
  }
  
  // Check if path is in allowed directories
  const isAllowed = ALLOWED_PATHS.some(allowed => 
    relativePath.startsWith(allowed) || relativePath === allowed.replace('/', '')
  );
  
  if (!isAllowed) {
    return { valid: false, error: "Access denied to this path" };
  }
  
  // Check for blocked patterns
  const isBlocked = BLOCKED_PATTERNS.some(pattern => 
    relativePath.includes(pattern)
  );
  
  if (isBlocked) {
    return { valid: false, error: "Cannot read this file type" };
  }
  
  // Check if file exists
  if (!existsSync(normalizedPath)) {
    return { valid: false, error: "File not found" };
  }
  
  // Check if it's a file (not directory)
  const stats = statSync(normalizedPath);
  if (stats.isDirectory()) {
    return { valid: false, error: "Path is a directory, not a file" };
  }
  
  return { valid: true };
}

/**
 * Read a file from the codebase
 */
export function readFile(filePath: string): {
  success: boolean;
  file_path?: string;
  content?: string;
  lines?: number;
  truncated?: boolean;
  error?: string;
} {
  const validation = validateFilePath(filePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const normalizedPath = resolve(PROJECT_ROOT, filePath);
    const content = readFileSync(normalizedPath, 'utf-8');
    const lines = content.split('\n').length;
    
    // Check file size
    if (content.length > MAX_FILE_SIZE) {
      return {
        success: true,
        file_path: filePath,
        content: content.substring(0, MAX_FILE_SIZE),
        lines,
        truncated: true,
      };
    }
    
    return {
      success: true,
      file_path: filePath,
      content,
      lines,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to read file: ${error.message}`,
    };
  }
}

/**
 * List files and directories in a path
 */
export function listDirectory(dirPath: string = '.'): {
  success: boolean;
  path?: string;
  items?: Array<{ name: string; type: 'file' | 'directory'; size?: number }>;
  error?: string;
} {
  try {
    const normalizedPath = resolve(PROJECT_ROOT, dirPath);
    const relativePath = relative(PROJECT_ROOT, normalizedPath);
    
    // Validate path
    if (relativePath.startsWith('..')) {
      return { success: false, error: "Path traversal not allowed" };
    }
    
    // Check if path is in allowed directories
    const isAllowed = ALLOWED_PATHS.some(allowed => 
      relativePath.startsWith(allowed) || relativePath === '.' || relativePath === ''
    );
    
    if (!isAllowed) {
      return { success: false, error: "Access denied to this path" };
    }
    
    // Check for blocked patterns
    const isBlocked = BLOCKED_PATTERNS.some(pattern => 
      relativePath.includes(pattern)
    );
    
    if (isBlocked || !existsSync(normalizedPath)) {
      return { success: false, error: "Directory not found or access denied" };
    }
    
    const stats = statSync(normalizedPath);
    if (!stats.isDirectory()) {
      return { success: false, error: "Path is not a directory" };
    }
    
    const items = readdirSync(normalizedPath, { withFileTypes: true })
      .filter(item => {
        // Filter out blocked directories
        if (item.isDirectory() && shouldSkipDir(item.name)) {
          return false;
        }
        // Filter out blocked files by extension
        if (item.isFile() && shouldSkipFile(item.name)) {
          return false;
        }
        // Filter out blocked patterns
        return !BLOCKED_PATTERNS.some(pattern => item.name.includes(pattern));
      })
      .map(item => {
        if (item.isFile()) {
          try {
            const fileStats = statSync(join(normalizedPath, item.name));
            return {
              name: item.name,
              type: 'file' as const,
              size: fileStats.size,
            };
          } catch {
            return {
              name: item.name,
              type: 'file' as const,
            };
          }
        } else {
          return {
            name: item.name,
            type: 'directory' as const,
          };
        }
      })
      .sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    
    return {
      success: true,
      path: dirPath,
      items,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to list directory: ${error.message}`,
    };
  }
}

/**
 * Search for code patterns across the codebase
 */
export function searchCode(
  query: string,
  fileType?: string,
  limit: number = 50
): {
  success: boolean;
  query?: string;
  matches?: Array<{
    file: string;
    line: number;
    content: string;
    context?: string;
  }>;
  total?: number;
  error?: string;
} {
  try {
    // Try ripgrep first (fastest)
    try {
      // Build ripgrep command
      let command = `rg -n --json "${query.replace(/"/g, '\\"')}"`;
      
      if (fileType) {
        command += ` --type ${fileType}`;
      } else {
        // Default to TypeScript/JavaScript files
        command += ' --type ts --type tsx --type js --type jsx';
      }
      
      // Limit results
      command += ` -m ${limit}`;
      
      // Exclude blocked directories
      BLOCKED_PATTERNS.forEach(pattern => {
        command += ` --glob '!${pattern}*'`;
      });
      
      const output = execSync(command, {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      // Parse ripgrep JSON output
      const lines = output.trim().split('\n');
      const matches: Array<{ file: string; line: number; content: string }> = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const result = JSON.parse(line);
          if (result.type === 'match') {
            matches.push({
              file: result.data.path.text,
              line: result.data.line_number,
              content: result.data.lines.text.trim(),
            });
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
      
      return {
        success: true,
        query,
        matches: matches.slice(0, limit),
        total: matches.length,
      };
    } catch (rgError: any) {
      // If ripgrep returns no results (exit code 1), that's OK - return empty results
      if (rgError.status === 1 || rgError.code === 1) {
        return {
          success: true,
          query,
          matches: [],
          total: 0,
        };
      }
      // Fall back to grep if ripgrep not available or other error
      try {
        const extensions = fileType 
          ? [fileType] 
          : ['ts', 'tsx', 'js', 'jsx'];
        
        const extPattern = extensions.map(ext => `\\.${ext}$`).join('|');
        const command = `grep -rn --include="*.${extensions[0]}" "${query.replace(/"/g, '\\"')}" ${ALLOWED_PATHS.join(' ')} | head -${limit}`;
        
        const output = execSync(command, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        
        const lines = output.trim().split('\n').filter(l => l.trim());
        const matches: Array<{ file: string; line: number; content: string }> = [];
        
        for (const line of lines) {
          const match = line.match(/^([^:]+):(\d+):(.+)$/);
          if (match) {
            const [, file, lineNum, content] = match;
            // Filter out blocked files
            if (!BLOCKED_PATTERNS.some(pattern => file.includes(pattern)) && !shouldSkipFile(file)) {
              matches.push({
                file: file.replace(PROJECT_ROOT + '/', ''),
                line: parseInt(lineNum, 10),
                content: content.trim(),
              });
            }
          }
        }
        
        return {
          success: true,
          query,
          matches: matches.slice(0, limit),
          total: matches.length,
        };
      } catch (grepError: any) {
        // Final fallback: simple file-based search
        return fallbackFileSearch(query, fileType, limit);
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Search failed: ${error.message}`,
    };
  }
}

/**
 * Fallback file-based search (slower but works without external tools)
 */
function fallbackFileSearch(
  query: string,
  fileType?: string,
  limit: number = 50
): {
  success: boolean;
  query?: string;
  matches?: Array<{ file: string; line: number; content: string }>;
  total?: number;
  error?: string;
} {
  const matches: Array<{ file: string; line: number; content: string }> = [];
  const queryLower = query.toLowerCase();
  
  function searchInDirectory(dirPath: string): void {
    try {
      const fullPath = resolve(PROJECT_ROOT, dirPath);
      if (!existsSync(fullPath)) return;
      
      const items = readdirSync(fullPath, { withFileTypes: true })
        .filter(item => {
          // Skip blocked directories
          if (item.isDirectory() && shouldSkipDir(item.name)) {
            return false;
          }
          // Skip blocked files by extension
          if (item.isFile() && shouldSkipFile(item.name)) {
            return false;
          }
          // Skip blocked patterns
          return !BLOCKED_PATTERNS.some(pattern => item.name.includes(pattern));
        });
      
      for (const item of items) {
        const itemPath = join(dirPath, item.name);
        const fullItemPath = resolve(PROJECT_ROOT, itemPath);
        
        // Skip blocked patterns
        if (BLOCKED_PATTERNS.some(pattern => itemPath.includes(pattern))) {
          continue;
        }
        
        if (item.isDirectory()) {
          // Recursively search directories
          if (ALLOWED_PATHS.some(allowed => itemPath.startsWith(allowed))) {
            searchInDirectory(itemPath);
          }
        } else if (item.isFile()) {
          // Check file extension
          const ext = item.name.split('.').pop()?.toLowerCase();
          const allowedExts = fileType ? [fileType] : ['ts', 'tsx', 'js', 'jsx'];
          
          if (ext && allowedExts.includes(ext)) {
            try {
              const content = readFileSync(fullItemPath, 'utf-8');
              const lines = content.split('\n');
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(queryLower)) {
                  matches.push({
                    file: itemPath,
                    line: index + 1,
                    content: line.trim(),
                  });
                }
              });
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    } catch {
      // Skip directories that can't be accessed
    }
  }
  
  // Search in allowed directories
  ALLOWED_PATHS.forEach(path => {
    if (path.endsWith('/')) {
      searchInDirectory(path);
    }
  });
  
  return {
    success: true,
    query,
    matches: matches.slice(0, limit),
    total: matches.length,
  };
}

/**
 * Get codebase structure and architecture overview
 */
export function getCodebaseStructure(): {
  success: boolean;
  structure?: {
    framework: string;
    language: string;
    database: string;
    auth: string;
    main_directories: Record<string, string>;
    key_files: Record<string, string>;
    patterns: Record<string, string>;
  };
  error?: string;
} {
  try {
    // Read package.json for dependencies
    const packageJsonPath = join(PROJECT_ROOT, 'package.json');
    let packageJson: any = {};
    if (existsSync(packageJsonPath)) {
      try {
        packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      } catch {
        // Ignore parse errors
      }
    }
    
    // Determine framework
    const framework = packageJson.dependencies?.next ? 'Next.js' : 'Unknown';
    const nextVersion = packageJson.dependencies?.next || packageJson.devDependencies?.next || 'Unknown';
    
    // Determine database
    let database = 'Unknown';
    if (packageJson.dependencies?.postgres || packageJson.dependencies?.['@supabase/supabase-js']) {
      database = 'PostgreSQL (Supabase)';
    } else if (packageJson.dependencies?.['better-sqlite3']) {
      database = 'SQLite';
    }
    
    // Determine auth
    let auth = 'Unknown';
    if (packageJson.dependencies?.['@supabase/supabase-js']) {
      auth = 'Supabase Auth';
    } else if (packageJson.dependencies?.['@clerk/nextjs']) {
      auth = 'Clerk';
    }
    
    return {
      success: true,
      structure: {
        framework: `${framework} ${nextVersion}`,
        language: 'TypeScript',
        database,
        auth,
        main_directories: {
          'app/': 'Next.js App Router - pages, API routes, and layouts',
          'components/': 'React components (UI components)',
          'lib/': 'Shared utilities, helpers, and business logic',
          'db/': 'Database migrations and schema definitions',
          'scripts/': 'Utility scripts and automation',
          'hooks/': 'Custom React hooks',
          'types/': 'TypeScript type definitions',
          'public/': 'Static assets',
        },
        key_files: {
          'app/api/admin/ai-assistant/route.ts': 'AI assistant API endpoint',
          'lib/db.ts': 'Database connection and SQL client',
          'middleware.ts': 'Authentication and routing middleware',
          'next.config.ts': 'Next.js configuration',
          'package.json': 'Project dependencies and scripts',
          'tsconfig.json': 'TypeScript configuration',
        },
        patterns: {
          api_routes: 'API routes in app/api/*/route.ts',
          components: 'React components in components/',
          database: 'Migrations in db/migrations/*.sql',
          utilities: 'Helper functions in lib/',
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get codebase structure: ${error.message}`,
    };
  }
}

/**
 * Find files related to a given file (imports, imported by, similar)
 */
export function findRelatedFiles(
  filePath: string,
  relationshipType: 'imports' | 'imported_by' | 'similar' = 'imports'
): {
  success: boolean;
  file_path?: string;
  relationship_type?: string;
  related_files?: Array<{ file: string; relationship: string }>;
  error?: string;
} {
  const validation = validateFilePath(filePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const normalizedPath = resolve(PROJECT_ROOT, filePath);
    const content = readFileSync(normalizedPath, 'utf-8');
    const relatedFiles: Array<{ file: string; relationship: string }> = [];
    
    if (relationshipType === 'imports') {
      // Find files this file imports
      const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        // Resolve relative imports
        if (importPath.startsWith('@/') || importPath.startsWith('./') || importPath.startsWith('../')) {
          // Try to resolve the path
          const resolvedPath = resolveImportPath(importPath, dirname(normalizedPath));
          if (resolvedPath) {
            relatedFiles.push({
              file: relative(PROJECT_ROOT, resolvedPath),
              relationship: 'imports',
            });
          }
        }
      }
    } else if (relationshipType === 'imported_by') {
      // Find files that import this file
      // This requires searching the entire codebase
      const fileName = basename(filePath, '.ts');
      const relativePath = relative(PROJECT_ROOT, normalizedPath);
      
      // Search for imports of this file
      const searchResult = searchCode(`from ['"]${relativePath.replace(/\\/g, '/')}['"]`, undefined, 100);
      if (searchResult.success && searchResult.matches) {
        searchResult.matches.forEach(match => {
          relatedFiles.push({
            file: match.file,
            relationship: 'imported_by',
          });
        });
      }
    }
    
    // Remove duplicates
    const uniqueFiles = Array.from(
      new Map(relatedFiles.map(item => [item.file, item])).values()
    );
    
    return {
      success: true,
      file_path: filePath,
      relationship_type: relationshipType,
      related_files: uniqueFiles,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to find related files: ${error.message}`,
    };
  }
}

/**
 * Helper to resolve import paths
 */
function resolveImportPath(importPath: string, fromDir: string): string | null {
  // Handle @/ alias (common in Next.js)
  if (importPath.startsWith('@/')) {
    const pathWithoutAlias = importPath.substring(2);
    const resolved = join(PROJECT_ROOT, pathWithoutAlias);
    // Try with .ts, .tsx extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
      const fullPath = resolved + ext;
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return resolved;
  }
  
  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const resolved = resolve(fromDir, importPath);
    // Try with extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
      const fullPath = resolved + ext;
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    if (existsSync(resolved)) {
      return resolved;
    }
  }
  
  return null;
}

