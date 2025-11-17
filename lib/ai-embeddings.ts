/**
 * AI Embeddings Service
 * Generates vector embeddings for semantic search using OpenAI
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for text using OpenAI ada-002
 * @param text Text to embed
 * @returns Vector embedding (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text.replace(/\n/g, " "), // Replace newlines with spaces
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts Array of texts to embed
 * @returns Array of embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // OpenAI allows up to 2048 inputs per batch
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: batch.map(text => text.replace(/\n/g, " ")),
      });

      embeddings.push(...response.data.map(item => item.embedding));
    }

    return embeddings;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}

/**
 * Extract key insights from conversation for knowledge base
 * Uses GPT to summarize and extract important information
 */
export async function extractKnowledgeFromConversation(
  messages: Array<{ role: string; content: string }>
): Promise<{
  insights: string[];
  summary: string;
  category: string;
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a knowledge extraction assistant. Analyze the conversation and extract:
1. Key insights and facts about the freight/logistics business
2. Patterns or trends mentioned
3. Important preferences or instructions
4. A brief summary (2-3 sentences)
5. A category (e.g., 'bid_insights', 'carrier_patterns', 'system_usage', 'analytics', 'general')

Return as JSON:
{
  "insights": ["insight1", "insight2", ...],
  "summary": "brief summary",
  "category": "category_name"
}`,
        },
        {
          role: "user",
          content: `Extract knowledge from this conversation:\n\n${conversationText}`,
        },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);

    return {
      insights: parsed.insights || [],
      summary: parsed.summary || "",
      category: parsed.category || "general",
    };
  } catch (error) {
    console.error("Error extracting knowledge:", error);
    return {
      insights: [],
      summary: "",
      category: "general",
    };
  }
}

