const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

// Configuration
const MAX_PRICE = 10000; // 10,000 KES
const OUTPUT_FILE = 'kenyan_flash_sales.json';

// Jumia Kenya URLs
const JUMIA_FLASH_SALES_URL = 'https://www.jumia.co.ke/mlp-flash-sales/';
const JUMIA_SEARCH_URL = 'https://www.jumia.co.ke/catalog/';

// User agent to mimic a real browser
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/**
 * Debug function to examine the HTML structure of Jumia's flash sales page
 */
async function examineJumiaPage() {
  try {
    console.log('Examining Jumia Kenya flash sales page structure...');
    
    const response = await axios.get(JUMIA_FLASH_SALES_URL, { headers: HEADERS });
    const html = response.data;
    
    // Save the HTML for examination
    await fs.writeFile('jumia_flash_sales_page.html', html);
    console.log('Saved Jumia flash sales page HTML to jumia_flash_sales_page.html');
    
    // Load with cheerio
    const $ = cheerio.load(html);
    
    // Try different selectors to find products
    console.log('\nTrying different selectors:');
    
    // Try common product selectors
    const selectors = [
      '.prd',
      '[data-gtm-product]',
      '.product',
      '.sku',
      '.item',
      '.-paxs .prd',
      '.-paxs [data-gtm-product]'
    ];
    
    selectors.forEach(selector => {
      const count = $(selector).length;
      console.log(`Selector "${selector}": ${count} elements found`);
      
      if (count > 0 && count < 5) {
        // Show details for selectors with few matches
        $(selector).each((index, element) => {
          console.log(`  Element ${index + 1}:`, $(element).text().substring(0, 100) + '...');
        });
      }
    });
    
    // Look for any price elements
    console.log('\nLooking for price elements:');
    const priceSelectors = ['.prc', '.price', '.cost', '[class*="price"]', '[class*="prc"]'];
    priceSelectors.forEach(selector => {
      const elements = $(selector);
      console.log(`Price selector "${selector}": ${elements.length} elements found`);
      elements.each((index, element) => {
        if (index < 3) { // Only show first 3
          console.log(`  ${selector} ${index + 1}:`, $(element).text());
        }
      });
    });
    
  } catch (error) {
    console.error('Error examining Jumia page:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  await examineJumiaPage();
}

// Run the examiner
if (require.main === module) {
  main();
}