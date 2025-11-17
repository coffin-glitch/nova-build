# AI Assistant Web Search - Implementation Options

## Current Status
❌ **Web search is NOT currently enabled**

## Options for Adding Web Search

### Option 1: Tavily API (Recommended for AI)
**Best for:** AI agents, real-time information, fact-checking

**Pros:**
- ✅ Designed specifically for AI/LLM use
- ✅ Returns clean, structured results
- ✅ Good for answering questions with current information
- ✅ Fast and reliable
- ✅ Free tier: 1,000 searches/month

**Cons:**
- ❌ Paid after free tier ($0.002 per search)
- ❌ Less comprehensive than Google

**Cost:** 
- Free: 1,000 searches/month
- Paid: $0.002 per search (~$2 per 1,000 searches)

**Setup:**
```bash
npm install tavily
```

**Example:**
```typescript
import { TavilySearchAPIClient } from "tavily";

const tavily = new TavilySearchAPIClient({ apiKey: process.env.TAVILY_API_KEY });

const results = await tavily.search("latest freight rates 2024", {
  search_depth: "basic", // or "advanced"
  max_results: 5,
});
```

---

### Option 2: SerpAPI (Google Search Results)
**Best for:** Comprehensive Google search results

**Pros:**
- ✅ Real Google search results
- ✅ Very comprehensive
- ✅ Includes images, videos, news, etc.
- ✅ Good for general web search

**Cons:**
- ❌ More expensive
- ❌ Results need more parsing/cleaning
- ❌ Can be slower

**Cost:**
- Free: 100 searches/month
- Paid: $50/month for 5,000 searches

**Setup:**
```bash
npm install serpapi
```

---

### Option 3: Google Custom Search API
**Best for:** Official Google integration

**Pros:**
- ✅ Official Google API
- ✅ Reliable
- ✅ Good for specific domains/sites

**Cons:**
- ❌ Requires Google Cloud setup
- ❌ More complex setup
- ❌ Limited to 100 free searches/day

**Cost:**
- Free: 100 searches/day
- Paid: $5 per 1,000 searches

---

### Option 4: DuckDuckGo (Free)
**Best for:** Free, privacy-focused search

**Pros:**
- ✅ Completely free
- ✅ No API key needed
- ✅ Privacy-focused

**Cons:**
- ❌ Less reliable
- ❌ Can be slow
- ❌ Results quality varies
- ❌ May violate ToS if used heavily

**Setup:**
```bash
npm install duckduckgo-scraper
```

---

## Recommended Approach: Tavily API

**Why Tavily?**
1. **Designed for AI** - Returns clean, structured data perfect for LLMs
2. **Cost-effective** - Free tier covers most use cases
3. **Fast** - Optimized for AI agents
4. **Easy integration** - Simple API

**Implementation:**
1. Sign up at https://tavily.com
2. Get API key
3. Add `TAVILY_API_KEY` to `.env.local`
4. Add `web_search` function to AI assistant
5. Update system prompt

**Example Function:**
```typescript
{
  name: "web_search",
  description: "Search the web for current information, news, facts, or any topic not in the codebase",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g., 'latest freight rates', 'trucking regulations 2024')",
      },
      max_results: {
        type: "number",
        description: "Maximum number of results (default 5)",
      },
    },
    required: ["query"],
  },
}
```

---

## Cost Analysis

### Tavily (Recommended)
- **Free tier:** 1,000 searches/month
- **Paid:** $0.002 per search
- **Monthly cost (moderate use):** $0-10/month

### SerpAPI
- **Free tier:** 100 searches/month
- **Paid:** $50/month for 5,000 searches
- **Monthly cost:** $50/month

### Google Custom Search
- **Free tier:** 100 searches/day (3,000/month)
- **Paid:** $5 per 1,000 searches
- **Monthly cost:** $0-25/month

---

## When to Use Web Search

The AI should use web search for:
- ✅ Current events and news
- ✅ Real-time data (stock prices, weather, etc.)
- ✅ Information not in your codebase
- ✅ Fact-checking
- ✅ Industry trends and regulations
- ✅ General knowledge questions

The AI should NOT use web search for:
- ❌ Questions about your codebase (use codebase functions)
- ❌ Questions about your database (use data functions)
- ❌ Questions it can answer from existing knowledge

---

## Implementation Plan

If you want to add web search:

1. **Choose provider** (recommend Tavily)
2. **Sign up and get API key**
3. **Install package** (`npm install tavily`)
4. **Create web search function** in `lib/web-search.ts`
5. **Add function to AI assistant** route
6. **Update system prompt** to explain when to use web search
7. **Test with queries like:**
   - "What are the latest freight rates?"
   - "What are the current trucking regulations?"
   - "What's the weather in Chicago?"

---

## Next Steps

Would you like me to:
1. ✅ Implement Tavily web search (recommended)
2. Implement SerpAPI (more comprehensive, more expensive)
3. Implement Google Custom Search (official, moderate cost)
4. Implement DuckDuckGo (free, less reliable)

Let me know which option you prefer!

