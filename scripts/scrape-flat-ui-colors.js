const https = require('https');
const { parse } = require('node-html-parser');

// Helper function to fetch HTML
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Extract color names and links from listing page
async function getColorsFromPage(pageNum) {
  const url = pageNum === 1 
    ? 'https://www.flatuicolorpicker.com/color-model/hsl-color-model/'
    : `https://www.flatuicolorpicker.com/color-model/hsl-color-model/page/${pageNum}/`;
  
  try {
    const html = await fetchHTML(url);
    const root = parse(html);
    const colors = [];
    
    // Try multiple selectors to find color links
    let links = root.querySelectorAll('a[href*="/colors/"]');
    
    // If no links found, try alternative structure
    if (links.length === 0) {
      links = root.querySelectorAll('article a');
    }
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || !href.includes('/colors/')) return;
      
      // Try to find the color name in h3 or from the link text
      let name = link.querySelector('h3')?.text?.trim();
      if (!name) {
        // Try getting text from the link itself
        const linkText = link.text?.trim();
        if (linkText && linkText.length > 0 && linkText.length < 50) {
          name = linkText;
        }
      }
      
      // Extract name from URL if still not found
      if (!name && href) {
        const urlMatch = href.match(/\/colors\/([^\/]+)/);
        if (urlMatch) {
          name = urlMatch[1].split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
        }
      }
      
      if (name && href) {
        const fullUrl = href.startsWith('http') ? href : `https://www.flatuicolorpicker.com${href}`;
        // Avoid duplicates
        if (!colors.find(c => c.name === name || c.url === fullUrl)) {
          colors.push({ name, url: fullUrl });
        }
      }
    });
    
    return colors;
  } catch (error) {
    console.error(`Error fetching page ${pageNum}:`, error.message);
    return [];
  }
}

// Extract HSL value from color detail page
async function getHSLFromColorPage(colorUrl) {
  try {
    const html = await fetchHTML(colorUrl);
    const root = parse(html);
    
    // Find all table rows
    const rows = root.querySelectorAll('tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const firstCell = cells[0].text?.trim();
        if (firstCell && firstCell.includes('HSL')) {
          const hslCell = cells[1];
          if (hslCell) {
            const hslText = hslCell.text.trim();
            // Extract HSL values: "(36, 50%, 92%);" -> "hsl(36, 50%, 92%)"
            const match = hslText.match(/\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
            if (match) {
              return `hsl(${match[1]}, ${match[2]}%, ${match[3]}%)`;
            }
            // Try alternative format without spaces
            const match2 = hslText.match(/\((\d+),([\d.]+)%,([\d.]+)%\)/);
            if (match2) {
              return `hsl(${match2[1]}, ${match2[2]}%, ${match2[3]}%)`;
            }
          }
        }
      }
    }
    
    // Fallback: search in all text for HSL pattern
    const allText = root.text;
    const hslMatch = allText.match(/HSL\s*\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/i);
    if (hslMatch) {
      return `hsl(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%)`;
    }
  } catch (error) {
    console.error(`Error fetching ${colorUrl}:`, error.message);
  }
  return null;
}

// Determine category from HSL value
function getCategory(hsl) {
  if (!hsl) return 'Special';
  const match = hsl.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if (!match) return 'Special';
  
  const h = parseInt(match[1]);
  const s = parseFloat(match[2]);
  const l = parseFloat(match[3]);
  
  // Low saturation = neutrals
  if (s < 20 || (l > 90 || l < 10)) return 'Neutrals';
  
  // Hue-based categorization
  if (h >= 0 && h < 15) return 'Reds';
  if (h >= 15 && h < 45) return 'Oranges';
  if (h >= 45 && h < 75) return 'Yellows';
  if (h >= 75 && h < 150) return 'Greens';
  if (h >= 150 && h < 195) return 'Cyans';
  if (h >= 195 && h < 240) return 'Blues';
  if (h >= 240 && h < 270) return 'Purples';
  if (h >= 270 && h < 300) return 'Pinks';
  return 'Special';
}

// Main scraping function
async function scrapeAllColors() {
  console.log('Starting to scrape colors from pages 2-12...');
  const allColors = [];
  
  // Get all color names and URLs from pages 2-12
  for (let page = 2; page <= 12; page++) {
    console.log(`Fetching page ${page}...`);
    const colors = await getColorsFromPage(page);
    allColors.push(...colors);
    console.log(`Found ${colors.length} colors on page ${page}`);
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\nTotal colors found: ${allColors.length}`);
  console.log('Fetching HSL values for each color...\n');
  
  // Get HSL values for each color
  const colorsWithHSL = [];
  for (let i = 0; i < allColors.length; i++) {
    const color = allColors[i];
    process.stdout.write(`\rProcessing ${i + 1}/${allColors.length}: ${color.name}`);
    const hsl = await getHSLFromColorPage(color.url);
    if (hsl) {
      const category = getCategory(hsl);
      colorsWithHSL.push({
        name: color.name,
        value: hsl,
        category: category
      });
    }
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n\nSuccessfully scraped ${colorsWithHSL.length} colors!`);
  return colorsWithHSL;
}

// Run the scraper
scrapeAllColors()
  .then(colors => {
    if (colors.length === 0) {
      console.log('\nNo colors found. Check the HTML structure.');
      process.exit(1);
    }
    
    // Format as TypeScript array for adding to EXPANDED_COLORS
    const formatted = colors.map(c => 
      `  { name: "${c.name}", value: "${c.value}", category: "${c.category}" }`
    ).join(',\n');
    
    console.log('\n=== Formatted Colors (for EXPANDED_COLORS) ===\n');
    console.log(formatted);
    
    // Also save to file for reference
    const fs = require('fs');
    const output = `// Scraped from https://www.flatuicolorpicker.com/color-model/hsl-color-model/ (pages 2-12)\n// Generated on ${new Date().toISOString()}\n// Add these to EXPANDED_COLORS in components/ui/AdvancedColorPicker.tsx\n\nexport const FLAT_UI_COLORS = [\n${formatted}\n];\n\nexport default FLAT_UI_COLORS;`;
    fs.writeFileSync('lib/flat-ui-colors-scraped.ts', output);
    console.log(`\n\nSaved ${colors.length} colors to lib/flat-ui-colors-scraped.ts`);
    console.log('\nCopy the formatted colors above and add them to EXPANDED_COLORS in AdvancedColorPicker.tsx');
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });

