# Directory Scraper Improvements

## Problem
The directory scraper was not picking up contact information (emails, phones, names) from the Highway.com carrier directory pages, even though the data was visible on the page.

## Solution Implemented

### 1. **Enhanced DOM Extraction**
- Multiple fallback selectors for finding contact rows
- Flexible field extraction with multiple selector strategies
- Better section detection using both h2 tags and text content

### 2. **Regex-Based Fallback Extraction**
Added comprehensive regex-based extraction that works even if DOM structure is different:

- **Email Extraction**: Uses regex to find all emails in the directory section
- **Phone Extraction**: Uses regex to find all phone numbers
- **Context Matching**: Matches emails with nearby text to find roles and names
- **Pattern Recognition**: Looks for common patterns like "Billing", "Dispatch", "Claims" followed by contact info

### 3. **Better Dynamic Content Handling**
- **MutationObserver**: Waits for elements to appear dynamically
- **Increased Wait Times**: Gives more time for content to load (3-5 seconds)
- **Element Detection**: Actively waits for `.carrier-directory` container

### 4. **Comprehensive Logging**
Added detailed console logging to debug extraction:
- Shows which emails/phones were found via regex
- Shows which contacts were extracted and how
- Shows available sections if expected ones aren't found

## How It Works

1. **Primary Method**: Tries to extract contacts using DOM selectors (fastest, most accurate)
2. **Fallback Method**: If DOM extraction finds fewer contacts than emails exist, uses regex to:
   - Extract all emails and phones from the directory text
   - Match emails with context (looks 500 chars before/after each email)
   - Find role keywords (Billing, Dispatch, Claims) near emails
   - Extract names and phones from surrounding text

## Alternative Approaches (For Future Consideration)

### Screenshot + OCR Approach
If DOM/regex extraction still fails, we could implement:

1. **html2canvas**: Take a screenshot of the directory section
2. **Tesseract.js**: OCR to extract text from the image
3. **Parse OCR Text**: Use regex on the OCR'd text

**Pros:**
- Works even if data is rendered as images
- Can extract data from complex visual layouts

**Cons:**
- Much slower (OCR takes time)
- Less accurate than DOM extraction
- Requires additional libraries
- Higher resource usage

**Implementation would require:**
```javascript
// Would need to add html2canvas and tesseract.js
import html2canvas from 'html2canvas';
import Tesseract from 'tesseract.js';

async function extractViaOCR(element) {
    const canvas = await html2canvas(element);
    const { data: { text } } = await Tesseract.recognize(canvas);
    // Then parse text with regex
}
```

### Puppeteer/Playwright Approach
Instead of Tampermonkey, could use a server-side scraper:

1. **Puppeteer**: Headless browser automation
2. **Full Page Access**: Can wait for all dynamic content
3. **Screenshot Capability**: Built-in screenshot support

**Pros:**
- More control over page loading
- Better handling of dynamic content
- Can take screenshots easily
- Server-side (no browser extension needed)

**Cons:**
- Requires server infrastructure
- More complex setup
- Can't run directly in user's browser

## Current Status

The scraper now uses a **hybrid approach**:
1. ✅ DOM-based extraction (primary)
2. ✅ Regex-based extraction (fallback)
3. ✅ Better waiting for dynamic content
4. ✅ Comprehensive logging

This should catch contacts even if:
- DOM structure changes
- Content loads dynamically
- Selectors don't match exactly

## Testing

When testing, check the browser console (F12) for:
- "Found emails via regex: [...]" - Shows all emails found
- "Contact extracted via regex: {...}" - Shows each contact found
- "Total contacts after regex fallback: X" - Final count

If contacts are still missing, the console logs will help identify why.

