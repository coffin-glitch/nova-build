# Using Highway Login Credentials

You have a few options for using your Highway.com login:

## Option 1: Generate New API Key (Recommended)

**Best approach:** Log into Highway's admin/developer portal and generate a new API key.

1. **Log into Highway Portal:**
   - Go to https://staging.highway.com (or https://highway.com for production)
   - Log in with your credentials

2. **Find API Key Settings:**
   - Look for "API Keys", "Developer Settings", "Integrations", or "API Access"
   - This might be in Settings → API Keys or Developer → API Access

3. **Generate New Key:**
   - Create a new API key
   - Make sure it's for **staging** environment
   - Copy the new key

4. **Update .env.local:**
   ```bash
   HIGHWAY_API_KEY=your_new_key_here
   ```

5. **Restart the server:**
   ```bash
   npm run dev
   ```

## Option 2: Check API Key Settings

While logged into Highway:

1. **Check IP Restrictions:**
   - Look for IP whitelist settings
   - Add your current server's IP if there's a whitelist

2. **Check API Key Permissions:**
   - Verify the key has access to carrier data endpoints
   - Check if there are any restrictions

3. **Verify Environment:**
   - Make sure you're using a **staging** API key (not production)
   - The base URL should be `https://staging.highway.com`

## Option 3: Contact Highway Support

Since you have a Highway account, you can:

1. **Email:** implementations@highway.com
2. **Ask them to:**
   - Verify your API key is active
   - Check for IP/device restrictions
   - Generate a new API key if needed
   - Whitelist your server's IP address

## Option 4: OAuth Flow (If Supported)

Highway's OAuth is primarily for "Sign In with Highway" (carrier authentication), not for broker API access. However, if Highway supports OAuth for API access, we can implement it.

**To check if OAuth is available:**
1. Log into Highway portal
2. Look for "OAuth Applications" or "API Credentials"
3. See if you can create an OAuth client for API access

If available, you'll need:
- `client_id`
- `client_secret`
- `redirect_uri` (if needed)

## Current Recommendation

**Start with Option 1** - Generate a new API key through the Highway portal. This is the most straightforward solution and will likely resolve the 401 error.

If you can't find the API key settings in the portal, contact Highway support directly - they can help you generate a new key or check your current key's permissions.

