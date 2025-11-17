# AI Assistant Setup Guide

## ⚠️ IMPORTANT: Security Notice

**Your API key was shared in chat. Please:**

1. **Rotate your API key immediately:**
   - Go to https://platform.openai.com/api-keys
   - Delete the exposed key
   - Create a new API key

2. **Add the new key to `.env.local`** (see below)

---

## Quick Setup

### 1. Add API Key to Environment

Add this line to your `.env.local` file:

```bash
OPENAI_API_KEY=sk-proj-YOUR_NEW_API_KEY_HERE
```

**Note:** The model name "gpt-5-nano" doesn't exist. The code uses `gpt-4o-mini` which is the cheapest GPT-4 model.

### 2. Restart Your Server

```bash
npm run dev
```

### 3. Access the AI Assistant

1. Log in as an admin
2. Go to `/admin` dashboard
3. Look for the floating bot icon in the bottom-right corner
4. Click it to open the AI chat interface

---

## Features

The AI assistant can:

- ✅ Answer questions about bid statistics
- ✅ Calculate metrics and comparisons
- ✅ Analyze carrier activity
- ✅ Query specific bids
- ✅ Provide insights about auction competition
- ✅ Compare time periods

### Example Questions:

- "What's our win rate this week?"
- "Show me today's bid statistics"
- "Which carriers are most active?"
- "What's the average bid amount for 500+ mile routes?"
- "Compare this week's activity to last week"
- "Show me bids that expired without any carrier bids"

---

## Cost Information

- **Model:** GPT-4o-mini (cheapest GPT-4)
- **Estimated cost:** $2-5/month for moderate use
- **Usage tracking:** Check your OpenAI dashboard at https://platform.openai.com/usage

---

## Troubleshooting

### "OpenAI API key not configured"
- Make sure `OPENAI_API_KEY` is in your `.env.local` file
- Restart your dev server after adding it

### "Failed to get AI response"
- Check your API key is valid
- Check you have credits in your OpenAI account
- Check the server console for error messages

### AI doesn't understand questions
- Try rephrasing your question
- Be more specific about what data you want
- Use natural language (e.g., "show me" instead of "SELECT")

---

## Technical Details

- **API Endpoint:** `/api/admin/ai-assistant`
- **Authentication:** Admin-only (uses `requireApiAdmin`)
- **Model:** `gpt-4o-mini`
- **Function Calling:** Yes (for database queries)
- **Context Window:** Last 10 messages

---

## Next Steps

1. ✅ Add API key to `.env.local`
2. ✅ Rotate your exposed API key
3. ✅ Test the assistant
4. ✅ Monitor usage in OpenAI dashboard

