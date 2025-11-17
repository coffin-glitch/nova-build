# Comprehensive Scraper Improvements

## Overview
Enhanced the Tampermonkey scraper to extract **ALL visible data** from Highway.com carrier pages using a comprehensive "select all and copy" approach, plus added a save button for carrier links in the Carrier Health Console.

## Key Improvements

### 1. **Comprehensive Text Extraction**
Added `getAllVisibleText()` function that:
- Uses `TreeWalker` API to traverse all visible text nodes
- Filters out hidden elements (display: none, visibility: hidden, opacity: 0)
- Removes script, style, noscript, and iframe elements
- Extracts ALL visible text like a "select all and copy" operation

### 2. **Enhanced Data Extraction (`extractComprehensiveData`)**
New function that extracts structured data from ALL visible text:
- **Emails**: All email addresses found (filtered to exclude highway.com, example.com, etc.)
- **Phones**: All phone numbers in various formats
- **Addresses**: Street addresses with common patterns
- **Names**: Potential names (capitalized words, 2-4 words)
- **Dates**: Various date formats
- **MC/DOT Numbers**: Motor carrier and DOT numbers
- **Full Text**: Complete visible text content
- **Full HTML**: Complete HTML structure

### 3. **Dual Extraction Strategy**
The scraper now uses a **two-tier approach**:

1. **Primary**: DOM-based extraction (fast, structured)
   - Uses CSS selectors to find specific elements
   - Extracts verified users, contacts, addresses, etc.

2. **Comprehensive Fallback**: Text-based extraction (robust, catches everything)
   - Extracts ALL visible text
   - Uses regex patterns to find emails, phones, addresses
   - Matches context around data points to build relationships
   - Works even if DOM structure changes

### 4. **Enhanced Overview Extraction**
- Now uses comprehensive extraction for Overview tab
- Captures all visible data including:
  - Insurance information
  - Safety & compliance scores
  - Carrier details
  - All contact information

### 5. **Enhanced Directory Extraction**
- Comprehensive extraction runs first to capture ALL data
- DOM extraction then structures the data
- Regex fallback ensures nothing is missed
- Comprehensive data is included in the payload for backend processing

### 6. **Save Carrier Link Button**
Added a save button in the Carrier Health Console:
- **Location**: Next to the Carrier URL input field
- **Functionality**: Copies the carrier link to clipboard
- **Available in**:
  - Initial paste step
  - Update Score Card step
- **Icon**: Save icon (floppy disk)
- **Feedback**: Toast notification on success/error

## Technical Details

### Comprehensive Extraction Function
```javascript
function extractComprehensiveData(container) {
    const allText = getAllVisibleText(container);
    // Extracts: emails, phones, addresses, names, dates, MC/DOT numbers
    // Returns structured object with all data
}
```

### TreeWalker Implementation
```javascript
const walker = document.createTreeWalker(
    clone,
    NodeFilter.SHOW_TEXT,
    {
        acceptNode: function(node) {
            // Check if parent is visible
            // Only include non-empty text nodes
        }
    }
);
```

### Data Structure Sent to Backend
```javascript
{
    verifiedUsers: [...],
    contacts: [...],
    rateConfirmationEmails: [...],
    addresses: [...],
    comprehensive: {
        allEmails: [...],
        allPhones: [...],
        allAddresses: [...],
        allNames: [...],
        allDates: [...],
        fullText: "..."
    }
}
```

## Benefits

1. **More Robust**: Catches data even if DOM structure changes
2. **Comprehensive**: Extracts ALL visible text, not just structured elements
3. **Fallback Safety**: Multiple extraction methods ensure nothing is missed
4. **Better Logging**: Console logs show exactly what was found
5. **User-Friendly**: Save button makes it easy to copy carrier links

## Console Logging

The scraper now logs comprehensive extraction results:
- `📊 Comprehensive extraction results:` - Shows counts of found data
- `📧 Found emails via comprehensive extraction:` - All emails found
- `📞 Found phones via comprehensive extraction:` - All phones found
- `Contact extracted via regex:` - Each contact found via fallback

## Testing

When testing the scraper:
1. Open browser console (F12)
2. Navigate to a carrier page on Highway.com
3. Click "🚀 Scrape to Nova - Directory"
4. Check console for comprehensive extraction logs
5. Verify all emails, phones, and contacts are captured

## Future Enhancements

Potential improvements:
- OCR integration for image-based data
- Machine learning for better name/contact matching
- Automatic relationship detection (which email belongs to which contact)
- Export comprehensive data to CSV/JSON

