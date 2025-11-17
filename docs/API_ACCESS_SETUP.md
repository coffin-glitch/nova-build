# API Access Setup for Highway Scraper

## The Issue

The Tampermonkey script needs to send data to your API. If your server isn't accessible at `novefreight.io` yet, you have two options:

## Option 1: Use Localhost (For Testing/Development) ✅ Recommended for Now

### Setup:
1. **Make sure your Next.js server is running locally:**
   ```bash
   npm run dev
   # Server should be running on http://localhost:3000
   ```

2. **Update the Tampermonkey script:**
   - Open Tampermonkey dashboard
   - Edit the `highway-auto-scraper` script
   - Find line 20 and set:
   ```javascript
   const API_BASE_URL = 'http://localhost:3000';
   ```

3. **Important**: The script runs in your browser, so `localhost:3000` refers to YOUR local machine, not the server where Highway.com is hosted.

### How It Works:
- ✅ Script runs in your browser (on Highway.com)
- ✅ Sends request to YOUR local machine (localhost:3000)
- ✅ Your local server processes the request
- ✅ Works as long as your dev server is running

### Limitations:
- ⚠️ Only works when your dev server is running
- ⚠️ Only works on your local machine
- ⚠️ Other admins can't use it (they'd need to run the server too)

---

## Option 2: Use Production Domain (When Ready)

### Setup:
1. **Deploy your server to `novefreight.io`**
   - Deploy to Vercel, Railway, or your hosting provider
   - Make sure the domain is configured

2. **Update the Tampermonkey script:**
   ```javascript
   const API_BASE_URL = 'https://novefreight.io';
   ```

3. **Verify CORS is configured:**
   - The API endpoint already has CORS support
   - It allows requests from `highway.com`
   - No additional configuration needed

### How It Works:
- ✅ Script runs in any admin's browser
- ✅ Sends request to your production server
- ✅ Works for all admins
- ✅ No need to run local server

---

## Option 3: Use ngrok (Temporary Public URL for Localhost)

If you want to test with a public URL but your server isn't deployed yet:

### Setup:
1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   # or download from ngrok.com
   ```

2. **Start your local server:**
   ```bash
   npm run dev
   ```

3. **Create tunnel:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

5. **Update Tampermonkey script:**
   ```javascript
   const API_BASE_URL = 'https://abc123.ngrok.io'; // Your ngrok URL
   ```

### Limitations:
- ⚠️ ngrok URL changes each time (unless you have paid plan)
- ⚠️ Temporary solution for testing
- ⚠️ Not recommended for production

---

## Current Configuration

The script is set to **auto-detect**:
- If you're on `localhost`, it uses `http://localhost:3000`
- Otherwise, it uses `https://novefreight.io`

You can override this by directly setting `API_BASE_URL` in the script.

---

## Testing

### Test Localhost Setup:
1. Start your dev server: `npm run dev`
2. Make sure it's accessible at `http://localhost:3000`
3. Install Tampermonkey script with `API_BASE_URL = 'http://localhost:3000'`
4. Go to Highway.com carrier page
5. Click "🚀 Scrape to Nova" button
6. Check your terminal for API request logs

### Test Production Setup:
1. Deploy to `novefreight.io`
2. Update script to use `https://novefreight.io`
3. Test from Highway.com
4. Check server logs

---

## Troubleshooting

### "Failed to fetch" or CORS error:
- ✅ CORS is already configured in the API
- ✅ Make sure your server is running
- ✅ Check that the URL in the script matches your server

### "Connection refused":
- ✅ Make sure your dev server is running
- ✅ Check the port (should be 3000)
- ✅ Try accessing `http://localhost:3000` in your browser

### Works locally but not in production:
- ✅ Make sure `novefreight.io` is deployed
- ✅ Check DNS is configured correctly
- ✅ Verify SSL certificate is valid
- ✅ Check server logs for errors

---

## Recommendation

**For now (while `novefreight.io` isn't set up):**
- ✅ Use **Option 1 (localhost)**
- ✅ Test locally first
- ✅ Once deployed, switch to **Option 2 (production)**

**For production:**
- ✅ Deploy to `novefreight.io`
- ✅ Update script to use production URL
- ✅ All admins can use it

