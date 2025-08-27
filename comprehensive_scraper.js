const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

// Configuration
const MAX_PRICE = 10000; // 10,000 KES
const OUTPUT_FILE = 'docs/kenyan_electronics_deals.json';

// Shop configurations
const SHOPS = [
  {
    name: 'Jumia Kenya',
    baseUrl: 'https://www.jumia.co.ke',
    flashSalesUrl: 'https://www.jumia.co.ke/mlp-flash-sales/',
    searchUrls: [
      'https://www.jumia.co.ke/laptops/',
      'https://www.jumia.co.ke/smartphones/'
    ]
  },
  {
    name: 'Kilimall Kenya',
    baseUrl: 'https://www.kilimall.co.ke',
    flashSalesUrl: 'https://www.kilimall.co.ke/new-flash-sale.html',
    searchUrls: [
      'https://www.kilimall.co.ke/kilimall-flash-sale-laptop-c-10000007.html',
      'https://www.kilimall.co.ke/kilimall-flash-sale-phone-c-10000001.html'
    ]
  }
];

// User agent to mimic a real browser
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/**
 * Scrapes a shop for deals
 */
async function scrapeShop(shop) {
  console.log(`\nScraping ${shop.name}...`);
  const products = [];
  
  try {
    // Try flash sales first
    console.log(`  Checking flash sales at ${shop.flashSalesUrl}`);
    const flashSaleProducts = await scrapePage(shop.flashSalesUrl, shop.name);
    products.push(...flashSaleProducts);
    
    // Then check specific category pages
    for (const url of shop.searchUrls) {
      console.log(`  Checking ${url}`);
      const pageProducts = await scrapePage(url, shop.name);
      products.push(...pageProducts);
    }
  } catch (error) {
    console.error(`  Error scraping ${shop.name}:`, error.message);
  }
  
  return products;
}

/**
 * Scrapes a specific page for products
 */
async function scrapePage(url, shopName) {
  try {
    const response = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(response.data);
    
    const products = [];
    
    // Try multiple selectors for product containers
    const productSelectors = [
      '.prd', 
      '.product-item',
      '.item',
      '[data-gtm-product]',
      '.product'
    ];
    
    let productElements = null;
    for (const selector of productSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        productElements = elements;
        console.log(`    Using selector "${selector}": ${elements.length} products found`);
        break;
      }
    }
    
    if (!productElements) {
      console.log(`    No product elements found on ${url}`);
      return [];
    }
    
    // Process each product element
    productElements.each((index, element) => {
      try {
        const product = extractProductInfo($(element), shopName, url);
        if (product && product.currentPrice && product.currentPrice <= MAX_PRICE) {
          // Only include phones and laptops
          if (product.category === 'phone' || product.category === 'laptop') {
            products.push(product);
          }
        }
      } catch (error) {
        // Skip individual product errors
        console.log(`    Error processing product ${index + 1}:`, error.message);
      }
    });
    
    return products;
  } catch (error) {
    console.error(`    Error fetching page ${url}:`, error.message);
    return [];
  }
}

/**
 * Extracts product information from a product element
 */
function extractProductInfo($element, shopName, pageUrl) {
  // Different approaches for different sites
  if (shopName.includes('Jumia')) {
    return extractJumiaProduct($element, shopName);
  } else if (shopName.includes('Kilimall')) {
    return extractKilimallProduct($element, shopName);
  } else {
    // Generic extraction
    return extractGenericProduct($element, shopName);
  }
}

/**
 * Extracts product information from Jumia product elements
 */
function extractJumiaProduct($element, shopName) {
  try {
    // Extract name
    const nameElement = $element.find('.name');
    const name = nameElement.text().trim() || 'Unknown Product';
    
    // Extract prices
    const currentPriceText = $element.find('.prc').text().trim();
    const originalPriceText = $element.find('.old').text().trim();
    
    // Extract numeric prices
    const currentPrice = extractPrice(currentPriceText);
    const originalPrice = extractPrice(originalPriceText) || currentPrice;
    
    // Extract discount
    const discountText = $element.find('.bdg._dsct').text().trim();
    const discount = discountText || calculateDiscount(originalPrice, currentPrice);
    
    // Extract URL
    const linkElement = $element.find('a');
    const relativeUrl = linkElement.attr('href');
    const url = relativeUrl ? `https://www.jumia.co.ke${relativeUrl}` : '';
    
    // Extract image
    const imageElement = $element.find('img');
    const imageUrl = imageElement.attr('data-src') || imageElement.attr('src') || '';
    
    // Determine category
    const category = determineCategory(name);
    
    // Validate required fields
    if (!name || !currentPrice) {
      return null;
    }
    
    return {
      shop: shopName,
      name,
      category,
      currentPrice,
      originalPrice,
      discount,
      url,
      imageUrl,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.log('Error extracting Jumia product:', error.message);
    return null;
  }
}

/**
 * Extracts product information from Kilimall product elements
 */
function extractKilimallProduct($element, shopName) {
  try {
    // Kilimall likely has a different structure
    // This is a placeholder implementation
    const name = $element.find('.title, .name').text().trim() || 'Unknown Product';
    const priceText = $element.find('.price, .prc').text().trim();
    const price = extractPrice(priceText);
    
    const category = determineCategory(name);
    
    if (!name || !price) {
      return null;
    }
    
    return {
      shop: shopName,
      name,
      category,
      currentPrice: price,
      originalPrice: price,
      discount: '',
      url: '',
      imageUrl: '',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.log('Error extracting Kilimall product:', error.message);
    return null;
  }
}

/**
 * Generic product extraction
 */
function extractGenericProduct($element, shopName) {
  try {
    const name = $element.find('h3, h4, .title, .name').first().text().trim() || 'Unknown Product';
    const priceText = $element.find('.price, .prc, .cost').first().text().trim();
    const price = extractPrice(priceText);
    
    const category = determineCategory(name);
    
    if (!name || !price) {
      return null;
    }
    
    return {
      shop: shopName,
      name,
      category,
      currentPrice: price,
      originalPrice: price,
      discount: '',
      url: '',
      imageUrl: '',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.log('Error extracting generic product:', error.message);
    return null;
  }
}

/**
 * Extracts numeric price from text (e.g., "KSh 8,500" -> 8500)
 */
function extractPrice(priceText) {
  if (!priceText) return null;
  
  // Remove currency symbols and commas
  const cleanedPrice = priceText.replace(/[Kk][Ss][Hh]\.?|,|Shs?\.?|\s/gi, '').trim();
  
  // Extract the first number found
  const match = cleanedPrice.match(/(\d+(?:\.\d+)?)/);
  const price = match ? parseFloat(match[1]) : null;
  
  // Filter out unrealistic prices (like 30, 54, etc.)
  if (price && price < 100) {
    return null; // Likely not a real product price
  }
  
  return price;
}

/**
 * Determines if a product is a phone or laptop
 */
function determineCategory(name) {
  if (!name) return null;
  
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('phone') || lowerName.includes('smartphone') || 
      lowerName.includes('iphone') || lowerName.includes('android') ||
      lowerName.includes('tecno') || lowerName.includes('infinix') ||
      lowerName.includes('samsung') || lowerName.includes('xiaomi')) {
    return 'phone';
  }
  
  if (lowerName.includes('laptop') || lowerName.includes('notebook') || 
      lowerName.includes('macbook') || lowerName.includes('computer') ||
      lowerName.includes('lenovo') || lowerName.includes('hp ') ||
      lowerName.includes('dell') || lowerName.includes('asus')) {
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
 * Removes duplicates from product list
 */
function removeDuplicates(products) {
  const seen = new Set();
  return products.filter(product => {
    const key = `${product.name}-${product.currentPrice}-${product.shop}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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
  console.log(`\nResults saved to ${OUTPUT_FILE}`);
  
  // Also generate HTML report
  await generateHTMLReport(data);
}

/**
 * Generates an HTML report with embedded data
 */
async function generateHTMLReport(data) {
  // Escape JSON data for use in HTML
  const escapedData = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kenyan Electronics Deals Under 10,000 KES</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .summary {
            background-color: #fff;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            text-align: center;
        }
        .products {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .product {
            background-color: #fff;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 15px;
            transition: transform 0.3s ease;
        }
        .product:hover {
            transform: translateY(-5px);
        }
        .product h3 {
            margin-top: 0;
            color: #333;
            font-size: 1.1em;
        }
        .price {
            font-size: 1.2em;
            font-weight: bold;
            color: #e74c3c;
        }
        .original-price {
            text-decoration: line-through;
            color: #999;
            margin-right: 10px;
        }
        .discount {
            background-color: #e74c3c;
            color: white;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 0.9em;
        }
        .shop {
            color: #7f8c8d;
            font-style: italic;
            margin-bottom: 10px;
        }
        .category {
            display: inline-block;
            color: white;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 0.8em;
            margin-bottom: 10px;
        }
        .laptop { background-color: #9b59b6; }
        .phone { background-color: #2ecc71; }
        .url {
            display: inline-block;
            margin-top: 10px;
            padding: 5px 10px;
            background-color: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 3px;
            font-size: 0.9em;
        }
        .url:hover {
            background-color: #2980b9;
        }
        .product-image {
            width: 100%;
            height: 200px;
            object-fit: contain;
            background-color: #f8f8f8;
            border-radius: 3px;
            margin-bottom: 10px;
        }
        .no-image {
            width: 100%;
            height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #f8f8f8;
            border-radius: 3px;
            margin-bottom: 10px;
            color: #999;
        }
    </style>
</head>
<body>
    <h1>Kenyan Electronics Deals Under 10,000 KES</h1>
    
    <div class="summary">
        <p>Last updated: <span id="timestamp">Loading...</span></p>
        <p>Total deals found: <span id="total-deals">0</span></p>
    </div>
    
    <div class="products" id="products-container">
        <!-- Products will be inserted here -->
    </div>

    <script>
        // Embedded data
        const data = ${escapedData};
        
        // Format timestamp for display
        function formatTimestamp(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleString('en-KE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // Display the data
        document.addEventListener('DOMContentLoaded', function() {
            // Update summary information
            document.getElementById('timestamp').textContent = formatTimestamp(data.timestamp);
            document.getElementById('total-deals').textContent = data.totalItems;
            
            // Display products
            const container = document.getElementById('products-container');
            
            data.items.forEach(product => {
                const productDiv = document.createElement('div');
                productDiv.className = 'product';
                
                // Create image element
                let imageElement = '';
                if (product.imageUrl) {
                    imageElement = '<img src="' + product.imageUrl + '" alt="' + product.name + '" class="product-image" onerror="this.parentElement.innerHTML=\\'<div class=\\\\\\'no-image\\\\\\'>No image available</div>\\'+this.parentElement.innerHTML; this.remove();">';
                } else {
                    imageElement = '<div class="no-image">No image available</div>';
                }
                
                let productHTML = imageElement +
                    '<div class="category ' + product.category + '">' + product.category.toUpperCase() + '</div>' +
                    '<h3>' + product.name + '</h3>' +
                    '<div>' +
                    '<span class="price">KES ' + product.currentPrice.toLocaleString() + '</span>';
                
                if (product.originalPrice && product.originalPrice > product.currentPrice) {
                    productHTML += '<span class="original-price">KES ' + product.originalPrice.toLocaleString() + '</span>';
                }
                
                if (product.discount) {
                    productHTML += '<span class="discount">' + product.discount + ' off</span>';
                }
                
                productHTML += '</div>' +
                    '<div class="shop">Shop: ' + product.shop + '</div>';
                
                if (product.url) {
                    productHTML += '<a href="' + product.url + '" class="url" target="_blank">View Product</a>';
                }
                
                productDiv.innerHTML = productHTML;
                container.appendChild(productDiv);
            });
        });
    </script>
</body>
</html>`;
  
  const htmlFile = 'docs/index.html';
  await fs.writeFile(htmlFile, htmlContent);
  console.log(`HTML report saved to ${htmlFile}`);
}

/**
 * Main function
 */
async function main() {
  console.log('Kenyan Electronics Deals Scraper');
  console.log(`Searching for phones and laptops under KES ${MAX_PRICE}`);
  console.log('===============================================\n');
  
  try {
    let allProducts = [];
    
    // Scrape each shop
    for (const shop of SHOPS) {
      const products = await scrapeShop(shop);
      allProducts.push(...products);
    }
    
    // Remove duplicates
    allProducts = removeDuplicates(allProducts);
    
    // Sort by price (lowest first)
    allProducts.sort((a, b) => a.currentPrice - b.currentPrice);
    
    // Display results
    console.log('\nFound deals under KES 10,000:');
    console.log('=============================');
    if (allProducts.length === 0) {
      console.log('No deals found matching criteria.');
    } else {
      allProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   Category: ${product.category}`);
        console.log(`   Price: KES ${product.currentPrice.toLocaleString()}`);
        if (product.originalPrice && product.originalPrice > product.currentPrice) {
          console.log(`   Original Price: KES ${product.originalPrice.toLocaleString()}`);
        }
        if (product.discount) {
          console.log(`   Discount: ${product.discount} off`);
        }
        console.log(`   Shop: ${product.shop}`);
        if (product.url) {
          console.log(`   URL: ${product.url}`);
        }
        console.log('');
      });
    }
    
    // Save to file
    await saveResults(allProducts);
    
    console.log(`Total unique items found: ${allProducts.length}`);
  } catch (error) {
    console.error('Error during scraping:', error.message);
  }
}

// Run the scraper
if (require.main === module) {
  main();
}

module.exports = {
  scrapeShop,
  extractPrice,
  determineCategory,
  calculateDiscount
};