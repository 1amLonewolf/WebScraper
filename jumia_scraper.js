const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

// Configuration
const MAX_PRICE = 10000; // 10,000 KES
const CATEGORIES = ['phone', 'laptop'];
const OUTPUT_FILE = 'kenyan_flash_sales.json';

// Jumia Kenya flash sales URL
const JUMIA_FLASH_SALES_URL = 'https://www.jumia.co.ke/mlp-flash-sales/';

// User agent to mimic a real browser
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/**
 * Scrapes Jumia Kenya for flash sales
 */
async function scrapeJumiaFlashSales() {
  try {
    console.log('Scraping Jumia Kenya flash sales...');
    
    const response = await axios.get(JUMIA_FLASH_SALES_URL, { headers: HEADERS });
    const $ = cheerio.load(response.data);
    
    const products = [];
    
    // Look for product items in the flash sale section
    $('.prd', '.-paxs').each((index, element) => {
      const productElement = $(element);
      
      // Extract product information
      const name = productElement.find('.name').text().trim();
      const currentPriceText = productElement.find('.prc').text().trim();
      const originalPriceText = productElement.find('.old').text().trim();
      const discountText = productElement.find('.bdg._dsct').text().trim();
      const productUrl = 'https://www.jumia.co.ke' + productElement.find('a').attr('href');
      const imageUrl = productElement.find('img').attr('data-src') || productElement.find('img').attr('src');
      
      // Extract numeric price values
      const currentPrice = extractPrice(currentPriceText);
      const originalPrice = extractPrice(originalPriceText) || currentPrice;
      
      // Determine category (phone or laptop)
      const category = determineCategory(name);
      
      // Only include phones and laptops
      if (category && currentPrice && currentPrice <= MAX_PRICE) {
        const product = {
          shop: 'Jumia Kenya',
          name,
          category,
          currentPrice,
          originalPrice,
          discount: discountText || calculateDiscount(originalPrice, currentPrice),
          url: productUrl,
          imageUrl,
          timestamp: new Date().toISOString()
        };
        
        products.push(product);
      }
    });
    
    console.log(`Found ${products.length} flash sale items on Jumia Kenya`);
    return products;
  } catch (error) {
    console.error('Error scraping Jumia Kenya:', error.message);
    return [];
  }
}

/**
 * Extracts numeric price from text (e.g., "KSh 8,500" -> 8500)
 */
function extractPrice(priceText) {
  if (!priceText) return null;
  
  // Remove currency symbols and commas
  const cleanedPrice = priceText.replace(/[Kk][Ss][Hh]\.?|,|Shs?\.?/gi, '').trim();
  
  // Extract the first number found
  const match = cleanedPrice.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Determines if a product is a phone or laptop
 */
function determineCategory(name) {
  if (!name) return null;
  
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('phone') || lowerName.includes('smartphone') || 
      lowerName.includes('iphone') || lowerName.includes('android')) {
    return 'phone';
  }
  
  if (lowerName.includes('laptop') || lowerName.includes('notebook') || 
      lowerName.includes('macbook') || lowerName.includes('computer')) {
    return 'laptop';
  }
  
  return null;
}

/**
 * Calculates discount percentage
 */
function calculateDiscount(originalPrice, currentPrice) {
  if (!originalPrice || !currentPrice || originalPrice <= currentPrice) {
    return '';
  }
  
  const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  return `${discount}%`;
}

/**
 * Saves results to a JSON file
 */
async function saveResults(results) {
  const data = {
    timestamp: new Date().toISOString(),
    totalItems: results.length,
    items: results
  };
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(`Results saved to ${OUTPUT_FILE}`);
}

/**
 * Main function
 */
async function main() {
  console.log('Kenyan Electronics Flash Sales Scraper');
  console.log(`Searching for phones and laptops under KES ${MAX_PRICE}`);
  console.log('----------------------------------------');
  
  try {
    // Scrape Jumia Kenya
    const jumiaProducts = await scrapeJumiaFlashSales();
    
    // Combine all products
    const allProducts = [...jumiaProducts];
    
    // Sort by price (lowest first)
    allProducts.sort((a, b) => a.currentPrice - b.currentPrice);
    
    // Display results
    console.log('\nFound items under KES 10,000:');
    console.log('============================');
    allProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: KES ${product.currentPrice}`);
      if (product.discount) {
        console.log(`   Discount: ${product.discount} off`);
      }
      console.log(`   Shop: ${product.shop}`);
      console.log(`   URL: ${product.url}`);
      console.log('');
    });
    
    // Save to file
    await saveResults(allProducts);
    
    console.log(`Total items found: ${allProducts.length}`);
  } catch (error) {
    console.error('Error during scraping:', error.message);
  }
}

// Run the scraper
if (require.main === module) {
  main();
}

module.exports = {
  scrapeJumiaFlashSales,
  extractPrice,
  determineCategory,
  calculateDiscount
};