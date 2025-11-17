# AI Assistant Codebase-Aware Architecture Plan

## Overview

This document explains what it would take to transform the current AI assistant into a **codebase-aware Language Model system** similar to Cursor's AI, where the assistant can read, understand, and interact with your entire codebase.

---

## Current State vs. Codebase-Aware System

### Current System
- ✅ Uses OpenAI API (GPT-4o-mini)
- ✅ Has function calling for database queries
- ✅ Can query bids, carriers, analytics
- ❌ Cannot read code files
- ❌ Cannot understand codebase structure
- ❌ Cannot suggest code changes
- ❌ Cannot debug by reading code

### Codebase-Aware System (Goal)
- ✅ Can read and understand all code files
- ✅ Understands project structure and architecture
- ✅ Can suggest code improvements
- ✅ Can debug by analyzing code
- ✅ Can generate code based on patterns in codebase
- ✅ Has semantic understanding of the entire codebase

---

## Architecture Options

### Option 1: Enhanced Function Calling (Recommended - Easiest)

**What it is:** Extend the current system with codebase-reading functions.

**How it works:**
1. Add new functions to read files, search code, understand structure
2. AI can call these functions when needed
3. Functions return code content, which AI analyzes
4. AI provides insights based on code it reads

**Implementation Requirements:**

#### New Functions to Add:

```typescript
{
  name: "read_file",
  description: "Read the contents of a file in the codebase",
  parameters: {
    file_path: "string" // e.g., "app/api/admin/bids/route.ts"
  }
}

{
  name: "search_code",
  description: "Search for code patterns, functions, or text across the codebase",
  parameters: {
    query: "string", // e.g., "how are bids archived"
    file_type: "string", // optional: "ts", "tsx", "sql"
    limit: "number"
  }
}

{
  name: "list_directory",
  description: "List files and directories in a path",
  parameters: {
    path: "string" // e.g., "app/api/admin"
  }
}

{
  name: "get_codebase_structure",
  description: "Get overview of codebase structure and architecture",
  parameters: {}
}

{
  name: "find_related_files",
  description: "Find files related to a given file or concept",
  parameters: {
    file_path: "string",
    relationship_type: "string" // "imports", "imported_by", "similar"
  }
}

{
  name: "analyze_code",
  description: "Analyze code for errors, patterns, or improvements",
  parameters: {
    file_path: "string",
    analysis_type: "string" // "errors", "performance", "security"
  }
}
```

#### Implementation Steps:

1. **File Reading System**
   ```typescript
   // lib/codebase-reader.ts
   import { readFileSync, readdirSync, statSync } from 'fs';
   import { join } from 'path';
   
   export function readFile(filePath: string): string {
     const fullPath = join(process.cwd(), filePath);
     return readFileSync(fullPath, 'utf-8');
   }
   
   export function searchCode(query: string, fileType?: string): Array<{
     file: string;
     line: number;
     content: string;
   }> {
     // Use grep or ripgrep to search codebase
     // Return matching lines with context
   }
   ```

2. **Codebase Indexing** (Optional but Recommended)
   - Create a searchable index of all files
   - Use tools like:
     - **ripgrep** (fast text search)
     - **tree-sitter** (AST parsing for better understanding)
     - **ts-morph** (TypeScript-specific analysis)

3. **Security Considerations**
   - Only allow reading files within project directory
   - Block access to sensitive files (.env, node_modules, etc.)
   - Validate file paths to prevent directory traversal

**Pros:**
- ✅ Easy to implement (extends current system)
- ✅ No new infrastructure needed
- ✅ Works with existing OpenAI API
- ✅ Can be implemented incrementally

**Cons:**
- ❌ Limited by token limits (can't read entire codebase at once)
- ❌ Slower (reads files on-demand)
- ❌ May miss relationships between files

**Cost:** Minimal - just development time

---

### Option 2: Local Language Model (Self-Hosted)

**What it is:** Run a local LLM (like Llama 3, Mistral, etc.) instead of OpenAI API.

**How it works:**
1. Download and run a local model
2. Model runs on your server/infrastructure
3. No API costs, full control
4. Can be fine-tuned on your codebase

**Implementation Requirements:**

#### Infrastructure:

1. **Model Selection:**
   - **Llama 3 8B/70B** (Meta) - Good for code understanding
   - **Mistral 7B/8x7B** - Fast, efficient
   - **CodeLlama** - Specifically trained for code
   - **DeepSeek Coder** - Excellent for code tasks

2. **Hardware Requirements:**
   - **8B models:** 16GB RAM minimum, GPU recommended
   - **70B models:** 80GB+ RAM, high-end GPU (A100/H100)
   - **Cloud option:** Run on AWS/GCP with GPU instances

3. **Software Stack:**
   ```bash
   # Using Ollama (easiest)
   npm install ollama
   
   # Or using vLLM (faster inference)
   pip install vllm
   
   # Or using llama.cpp (CPU-friendly)
   ```

4. **Integration:**
   ```typescript
   // lib/local-llm.ts
   import { Ollama } from 'ollama';
   
   const ollama = new Ollama({
     host: 'http://localhost:11434'
   });
   
   export async function callLocalLLM(messages: any[], functions: any[]) {
     const response = await ollama.chat({
       model: 'llama3:8b',
       messages,
       functions,
       temperature: 0.9
     });
     return response;
   }
   ```

**Pros:**
- ✅ No API costs
- ✅ Full control over model
- ✅ Can fine-tune on your codebase
- ✅ Data privacy (everything stays local)
- ✅ No rate limits

**Cons:**
- ❌ Requires significant hardware
- ❌ Slower than cloud APIs (unless you have GPUs)
- ❌ More complex setup and maintenance
- ❌ May be less capable than GPT-4
- ❌ Need to manage model updates

**Cost:** 
- Hardware: $500-$5000+ (GPU server)
- Cloud GPU: $0.50-$5/hour
- Development: Significant time investment

---

### Option 3: Hybrid Approach (Best of Both Worlds)

**What it is:** Use OpenAI for complex reasoning, local model for codebase reading.

**How it works:**
1. Local model/indexer reads and indexes codebase
2. When user asks code-related question:
   - Local system finds relevant code
   - Sends code snippets + question to OpenAI
   - OpenAI provides intelligent analysis
3. Best of both: fast code search + intelligent reasoning

**Implementation:**

```typescript
// 1. Codebase Indexer (runs locally)
const codebaseIndex = await indexCodebase(); // Creates searchable index

// 2. When user asks code question
const relevantCode = await searchCodebase(userQuestion, codebaseIndex);

// 3. Send to OpenAI with context
const response = await openai.chat.completions.create({
  messages: [
    { role: "system", content: "You are a codebase expert..." },
    { role: "user", content: `${userQuestion}\n\nRelevant code:\n${relevantCode}` }
  ]
});
```

**Pros:**
- ✅ Fast code search (local)
- ✅ Intelligent analysis (OpenAI)
- ✅ Cost-effective (only uses OpenAI when needed)
- ✅ Privacy for codebase (indexing stays local)

**Cons:**
- ❌ More complex architecture
- ❌ Still has API costs (but reduced)

---

## Recommended Implementation Plan

### Phase 1: Enhanced Function Calling (Start Here)

**Timeline:** 1-2 weeks

1. **Add File Reading Functions**
   - `read_file` - Read any file in codebase
   - `list_directory` - Browse directory structure
   - `search_code` - Search for code patterns

2. **Add Codebase Understanding Functions**
   - `get_codebase_structure` - Overview of architecture
   - `find_related_files` - Find imports/dependencies
   - `analyze_code` - Basic code analysis

3. **Security Layer**
   - Path validation
   - File access restrictions
   - Rate limiting

**Result:** AI can read and understand your codebase on-demand

### Phase 2: Codebase Indexing (Optional Enhancement)

**Timeline:** 1 week

1. **Build Search Index**
   - Index all TypeScript/TSX files
   - Extract functions, classes, types
   - Build relationship graph

2. **Semantic Search**
   - Use embeddings for code search
   - Find semantically similar code
   - Understand code patterns

**Result:** Faster, more intelligent code search

### Phase 3: Local Model (If Needed)

**Timeline:** 2-4 weeks

1. **Set up Ollama or similar**
2. **Choose appropriate model**
3. **Integrate with existing system**
4. **Fine-tune on your codebase** (optional)

**Result:** Self-hosted AI with full codebase access

---

## Technical Implementation Details

### File Reading Function Example

```typescript
async function readFile(params: any) {
  const { file_path } = params;
  
  // Security: Validate path
  const allowedPaths = [
    'app/',
    'components/',
    'lib/',
    'db/',
    'scripts/',
  ];
  
  if (!allowedPaths.some(path => file_path.startsWith(path))) {
    return { error: "Access denied to this path" };
  }
  
  // Block sensitive files
  const blockedPatterns = [
    '.env',
    'node_modules',
    '.next',
    'package-lock.json',
  ];
  
  if (blockedPatterns.some(pattern => file_path.includes(pattern))) {
    return { error: "Cannot read this file type" };
  }
  
  try {
    const content = readFileSync(join(process.cwd(), file_path), 'utf-8');
    
    // Limit file size (e.g., 50KB)
    if (content.length > 50000) {
      return {
        content: content.substring(0, 50000),
        truncated: true,
        message: "File is large, showing first 50KB"
      };
    }
    
    return {
      file_path,
      content,
      lines: content.split('\n').length,
    };
  } catch (error) {
    return { error: `Failed to read file: ${error.message}` };
  }
}
```

### Code Search Function Example

```typescript
async function searchCode(params: any) {
  const { query, file_type, limit = 20 } = params;
  
  // Use ripgrep or similar for fast search
  const results = await exec(`rg -n "${query}" --type ${file_type || 'ts'} -l`);
  
  // Parse results and return with context
  return {
    query,
    matches: results.map(result => ({
      file: result.file,
      line: result.line,
      content: result.content,
      context: result.context, // Surrounding lines
    })),
    total: results.length,
  };
}
```

### Codebase Structure Function

```typescript
async function getCodebaseStructure() {
  return {
    architecture: {
      framework: "Next.js 16",
      language: "TypeScript",
      database: "PostgreSQL",
      auth: "Supabase",
    },
    main_directories: {
      app: "Next.js app router - pages and API routes",
      components: "React components",
      lib: "Shared utilities and helpers",
      db: "Database migrations and schemas",
      scripts: "Utility scripts",
    },
    key_files: {
      "app/api/admin/ai-assistant/route.ts": "AI assistant API endpoint",
      "lib/db.ts": "Database connection",
      "middleware.ts": "Auth middleware",
      // ... more key files
    },
    patterns: {
      api_routes: "All API routes in app/api/",
      components: "Components in components/",
      database: "Migrations in db/migrations/",
    }
  };
}
```

---

## Security Considerations

### 1. Path Validation
- Only allow reading files within project root
- Block access to:
  - `.env*` files
  - `node_modules/`
  - `.next/`
  - `.git/`
  - System files

### 2. Rate Limiting
- Limit file reads per minute
- Prevent reading entire codebase in one request
- Cache frequently accessed files

### 3. Content Filtering
- Don't expose secrets even if file is readable
- Sanitize file contents before sending to AI
- Log all file access for audit

### 4. Admin-Only Access
- Only admins can use codebase functions
- Verify admin role before allowing file access

---

## Cost Analysis

### Option 1: Enhanced Function Calling (OpenAI)
- **Development:** 1-2 weeks
- **Infrastructure:** $0 (uses existing)
- **API Costs:** ~$0.10-0.50 per 1000 codebase queries
- **Total:** ~$10-50/month (depending on usage)

### Option 2: Local Model
- **Development:** 2-4 weeks
- **Hardware:** $500-5000 (one-time) or $200-2000/month (cloud GPU)
- **Infrastructure:** Server maintenance
- **API Costs:** $0
- **Total:** $200-2000/month (cloud) or $500-5000 one-time (self-hosted)

### Option 3: Hybrid
- **Development:** 2-3 weeks
- **Infrastructure:** $50-200/month (lightweight indexing server)
- **API Costs:** ~$5-20/month (reduced OpenAI usage)
- **Total:** $55-220/month

---

## Recommended Approach

**Start with Option 1 (Enhanced Function Calling):**

1. **Week 1:** Add `read_file`, `list_directory`, `search_code` functions
2. **Week 2:** Add codebase structure and analysis functions
3. **Test:** See how well it works with your codebase
4. **Iterate:** Add more functions based on needs

**If you need more:**
- Add codebase indexing (Phase 2)
- Consider local model only if you have specific privacy/control needs

---

## Example: What the AI Could Do

### Current Capabilities:
- "How many expired auctions from CA?" → Queries database

### With Codebase Awareness:
- "How does the bid archiving system work?" → Reads `lib/archive-migration.ts`, explains the flow
- "Show me where carrier profiles are created" → Finds and shows relevant code
- "Why is this API route slow?" → Analyzes code, suggests optimizations
- "Add a new endpoint for X" → Generates code following your patterns
- "Fix the bug in bid parsing" → Reads code, identifies issue, suggests fix

---

## Next Steps

If you want to proceed, I can:

1. **Implement Phase 1** (file reading functions) - Start here
2. **Set up codebase indexing** - For faster search
3. **Integrate local model** - If you have hardware/cloud setup

The easiest and most effective approach is **Option 1** - it gives you 80% of the benefits with 20% of the effort.

