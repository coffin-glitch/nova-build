# How to Capture the Exact USPS Request

The 500 error suggests the XML format might not match what the server expects. We need to capture the **exact** request from your browser.

## Step-by-Step Instructions

### 1. Open Browser DevTools
- Press `F12` or right-click → "Inspect"
- Go to the **Network** tab

### 2. Navigate to USPS Freight Auction
- Go to the Freight Auction page in your browser
- Make sure you can see the load table

### 3. Clear Network Log
- Click the "Clear" button (🚫) in the Network tab

### 4. Trigger a Page Load/Refresh
- Click a pagination button (Page 2, Page 3, etc.)
- OR refresh the table
- This will trigger a request to `view.x2ps`

### 5. Find the Request
- In the Network tab, look for a request to `view.x2ps`
- It should be a POST request
- Click on it

### 6. Copy Request Details

#### A. Copy the Request URL
- In the **Headers** tab, find "Request URL"
- Copy the full URL (including query parameters)

#### B. Copy All Request Headers
- Still in **Headers** tab, scroll to "Request Headers"
- Copy all headers (especially `Cookie`, `Content-Type`, `Referer`, etc.)

#### C. Copy the Request Payload (XML)
- Go to the **Payload** tab (or **Request** tab)
- Find the XML body
- Copy the **entire** XML string

### 7. Share the Information

Please share:
1. **Request URL** (full URL with query params)
2. **Request Headers** (especially Cookie, Content-Type, Referer)
3. **Request Body** (the complete XML)

## Alternative: Use Browser Extension

You can also use a browser extension like:
- **Requestly** - Intercept and modify requests
- **ModHeader** - Modify request headers
- **Postman Interceptor** - Capture requests

## What We Need

The most important parts:
1. **The exact XML structure** - Every tag, every attribute
2. **The SYS_ID value** - This might be session-specific
3. **All headers** - Especially cookies and referer
4. **The URL format** - Query parameters and structure

Once we have this, we can update the XML template to match exactly what the server expects.

