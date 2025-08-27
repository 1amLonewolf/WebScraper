const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

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
  // Format the timestamp for display
  const formattedTimestamp = new Date(data.timestamp).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Calculate statistics
  const laptopDeals = data.items.filter(item => item.category === 'laptop').length;
  const phoneDeals = data.items.filter(item => item.category === 'phone').length;
  
  // Generate product HTML
  let productsHTML = '';
  data.items.forEach(product => {
    // Create image element
    let imageElement = '';
    if (product.imageUrl) {
      imageElement = `
        <div class="product-image-container">
          <img src="${product.imageUrl}" alt="${product.name}" class="product-image" onerror="this.onerror=null;this.parentElement.innerHTML='&lt;div class=&quot;no-image&quot;&gt;No image available&lt;/div&gt;';">
        </div>`;
    } else {
      imageElement = `
        <div class="product-image-container">
          <div class="no-image">No image available</div>
        </div>`;
    }
    
    // Build product HTML
                    productsHTML += `
                      <div class="product" data-category="${product.category}" data-price="${product.currentPrice}" data-shop="${product.shop}">
                        ${imageElement}
                        <div class="product-content">
                          <div class="category ${product.category}">${product.category.toUpperCase()}</div>
                          <h3>${product.name}</h3>
                          <div class="shop">Shop: ${product.shop}</div>
                          <div class="price-container">
                            <span class="price">KES ${product.currentPrice.toLocaleString()}</span>`;
    
    if (product.originalPrice && product.originalPrice > product.currentPrice) {
      productsHTML += `<span class="original-price">KES ${product.originalPrice.toLocaleString()}</span>`;
    }
    
    if (product.discount) {
      productsHTML += `<span class="discount">${product.discount} off</span>`;
    }
    
    productsHTML += `
          </div>`;
    
    if (product.url) {
      productsHTML += `<a href="${product.url}" class="url" target="_blank">View Deal</a>`;
    }
    
    productsHTML += `
        </div>
      </div>`;
  });
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kenyan Electronics Deals Under 10,000 KES</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4edf9 100%);
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            text-align: center;
            padding: 30px 0;
            margin-bottom: 30px;
            background: linear-gradient(90deg, #ff6b6b, #ffa502, #ff6b6b);
            border-radius: 15px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            color: white;
            position: relative;
            overflow: hidden;
        }
        
        header::before {
            content: "";
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
            transform: rotate(30deg);
        }
        
        h1 {
            font-size: 2.8rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            position: relative;
        }
        
        .subtitle {
            font-size: 1.2rem;
            font-weight: 300;
            max-width: 700px;
            margin: 0 auto;
            position: relative;
        }
        
        .summary {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 20px;
            border-top: 5px solid #4361ee;
        }
        
        .summary-item {
            text-align: center;
            flex: 1;
            min-width: 200px;
        }
        
        .summary-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: #4361ee;
        }
        
        .summary-label {
            font-size: 1.1rem;
            color: #666;
            font-weight: 500;
        }
        
        .last-updated {
            font-size: 0.9rem;
            color: #888;
            margin-top: 5px;
        }
        
        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 30px;
            padding: 20px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }
        
        .filter-group {
            flex: 1;
            min-width: 200px;
        }
        
        .filter-group h3 {
            margin-bottom: 10px;
            color: #4361ee;
            font-size: 1.1rem;
        }
        
        .filter-btn {
            padding: 8px 15px;
            background: white;
            border: 2px solid #4361ee;
            border-radius: 30px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            font-size: 0.9rem;
            color: #4361ee;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            margin: 5px 5px 5px 0;
        }
        
        .filter-btn:hover {
            background: #4361ee;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
        }
        
        .filter-btn.active {
            background: #4361ee;
            color: white;
            box-shadow: 0 4px 8px rgba(67, 97, 238, 0.3);
        }
        
        .search-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .search-group input {
            padding: 10px 15px;
            border: 2px solid #4361ee;
            border-radius: 30px;
            font-family: 'Poppins', sans-serif;
            font-size: 1rem;
        }
        
        .search-group button {
            padding: 8px 15px;
            background: #ff6b6b;
            border: none;
            border-radius: 30px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .search-group button:hover {
            background: #ff5252;
            transform: translateY(-2px);
        }
        
        .products {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 30px;
        }
        
        .product {
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        
        .product:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.15);
        }
        
        .product-image-container {
            height: 220px;
            overflow: hidden;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .product-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            transition: transform 0.3s ease;
        }
        
        .product:hover .product-image {
            transform: scale(1.05);
        }
        
        .no-image {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #aaa;
            font-size: 1rem;
        }
        
        .product-content {
            padding: 20px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
        }
        
        .category {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 15px;
            align-self: flex-start;
        }
        
        .laptop {
            background: linear-gradient(90deg, #7209b7, #560bad);
            color: white;
        }
        
        .phone {
            background: linear-gradient(90deg, #4cc9f0, #4361ee);
            color: white;
        }
        
        .product h3 {
            font-size: 1.2rem;
            margin-bottom: 15px;
            color: #222;
            flex-grow: 1;
        }
        
        .shop {
            color: #777;
            font-size: 0.9rem;
            margin-bottom: 15px;
        }
        
        .price-container {
            margin-bottom: 20px;
        }
        
        .price {
            font-size: 1.5rem;
            font-weight: 700;
            color: #ff6b6b;
        }
        
        .original-price {
            text-decoration: line-through;
            color: #999;
            margin-right: 10px;
            font-size: 1.1rem;
        }
        
        .discount {
            background: linear-gradient(90deg, #f72585, #b5179e);
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-left: 10px;
        }
        
        .url {
            display: inline-block;
            padding: 12px 20px;
            background: linear-gradient(90deg, #4361ee, #3a0ca3);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            transition: all 0.3s ease;
            margin-top: auto;
        }
        
        .url:hover {
            background: linear-gradient(90deg, #3a0ca3, #4361ee);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(67, 97, 238, 0.4);
        }
        
        .loading {
            text-align: center;
            font-size: 1.5rem;
            padding: 50px;
            color: #4361ee;
            font-weight: 500;
        }
        
        .loading::after {
            content: ".";
            animation: dots 1.5s infinite;
        }
        
        @keyframes dots {
            0%, 20% { content: "."; }
            40% { content: ".."; }
            60%, 100% { content: "..."; }
        }
        
        .error-message {
            background: #ff6b6b;
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            font-weight: 500;
            margin: 20px 0;
            box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
        }
        
        footer {
            text-align: center;
            padding: 30px 0;
            margin-top: 40px;
            color: #666;
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 15px;
            }
            
            h1 {
                font-size: 2.2rem;
            }
            
            .summary {
                flex-direction: column;
            }
            
            .products {
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔥 Kenyan Electronics Deals 🔥</h1>
            <p class="subtitle">Daily updated flash sales and special offers for phones and laptops under 10,000 KES</p>
        </header>
        
        <div class="summary">
            <div class="summary-item">
                <div class="summary-value" id="total-deals">${data.totalItems}</div>
                <div class="summary-label">Total Deals</div>
                <div class="last-updated">Last updated: <span id="timestamp">${formattedTimestamp}</span></div>
            </div>
            <div class="summary-item">
                <div class="summary-value" id="laptop-deals">${laptopDeals}</div>
                <div class="summary-label">Laptop Deals</div>
            </div>
            <div class="summary-item">
                <div class="summary-value" id="phone-deals">${phoneDeals}</div>
                <div class="summary-label">Phone Deals</div>
            </div>
        </div>
        
        <div class="controls">
            <div class="filter-group">
                <h3>Category</h3>
                <button class="filter-btn active" data-filter="all">All Deals</button>
                <button class="filter-btn" data-filter="laptop">Laptops</button>
                <button class="filter-btn" data-filter="phone">Phones</button>
            </div>
            
            <div class="filter-group">
                <h3>Price Range</h3>
                <button class="filter-btn" data-filter="price-all">All Prices</button>
                <button class="filter-btn" data-filter="price-0-1000">Under KES 1,000</button>
                <button class="filter-btn" data-filter="price-1000-5000">KES 1,000 - 5,000</button>
                <button class="filter-btn" data-filter="price-5000-10000">KES 5,000 - 10,000</button>
            </div>
            
            <div class="filter-group">
                <h3>Shop</h3>
                <button class="filter-btn active" data-filter="shop-all">All Shops</button>
                <button class="filter-btn" data-filter="shop-jumia">Jumia Kenya</button>
                <button class="filter-btn" data-filter="shop-kilimall">Kilimall Kenya</button>
            </div>
            
            <div class="filter-group">
                <h3>Discount</h3>
                <button class="filter-btn" data-filter="discount-all">Any Discount</button>
                <button class="filter-btn" data-filter="discount-20">20%+ Off</button>
                <button class="filter-btn" data-filter="discount-30">30%+ Off</button>
                <button class="filter-btn" data-filter="discount-50">50%+ Off</button>
            </div>
            
            <div class="filter-group search-group">
                <h3>Search</h3>
                <input type="text" id="search-input" placeholder="Search products...">
                <button id="clear-search">Clear</button>
            </div>
        </div>
        
        <div id="loading" class="loading" style="display: none;">Loading amazing deals</div>
        <div id="error" class="error-message" style="display: none;"></div>
        <div class="products" id="products-container">
            ${productsHTML}
        </div>
        
        <footer>
            <p>Data refreshed daily • Last scrape: <span id="footer-timestamp">${formattedTimestamp}</span></p>
            <p>Deals from Jumia Kenya and other Kenyan online shops</p>
        </footer>
    </div>

    <script>
        // Store all products for filtering
        const allProducts = ${JSON.stringify(data.items)};
        
        // Current filter states
        const currentFilters = {
            category: 'all',
            priceRange: 'price-all',
            shop: 'shop-all',
            discount: 'discount-all',
            search: ''
        };
        
        // Add filter functionality
        document.addEventListener('DOMContentLoaded', function() {
            // Category filters
            const categoryButtons = document.querySelectorAll('.filter-btn[data-filter="all"], .filter-btn[data-filter="laptop"], .filter-btn[data-filter="phone"]');
            categoryButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // Update active button
                    categoryButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update filter
                    currentFilters.category = this.dataset.filter;
                    applyFilters();
                });
            });
            
            // Price range filters
            const priceButtons = document.querySelectorAll('.filter-btn[data-filter^="price-"]');
            priceButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // Update active button
                    priceButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update filter
                    currentFilters.priceRange = this.dataset.filter;
                    applyFilters();
                });
            });
            
            // Shop filters
            const shopButtons = document.querySelectorAll('.filter-btn[data-filter^="shop-"]');
            shopButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // Update active button
                    shopButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update filter
                    currentFilters.shop = this.dataset.filter;
                    applyFilters();
                });
            });
            
            // Discount filters
            const discountButtons = document.querySelectorAll('.filter-btn[data-filter^="discount-"]');
            discountButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // Update active button
                    discountButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update filter
                    currentFilters.discount = this.dataset.filter;
                    applyFilters();
                });
            });
            
            // Search functionality
            const searchInput = document.getElementById('search-input');
            searchInput.addEventListener('input', function() {
                currentFilters.search = this.value.toLowerCase();
                applyFilters();
            });
            
            const clearSearchButton = document.getElementById('clear-search');
            clearSearchButton.addEventListener('click', function() {
                searchInput.value = '';
                currentFilters.search = '';
                applyFilters();
            });
            
            // Apply all filters
            function applyFilters() {
                const productsContainer = document.getElementById('products-container');
                let filteredProducts = [...allProducts];
                
                // Apply category filter
                if (currentFilters.category !== 'all') {
                    filteredProducts = filteredProducts.filter(product => product.category === currentFilters.category);
                }
                
                // Apply price range filter
                if (currentFilters.priceRange !== 'price-all') {
                    switch (currentFilters.priceRange) {
                        case 'price-0-1000':
                            filteredProducts = filteredProducts.filter(product => product.currentPrice < 1000);
                            break;
                        case 'price-1000-5000':
                            filteredProducts = filteredProducts.filter(product => product.currentPrice >= 1000 && product.currentPrice <= 5000);
                            break;
                        case 'price-5000-10000':
                            filteredProducts = filteredProducts.filter(product => product.currentPrice > 5000 && product.currentPrice <= 10000);
                            break;
                    }
                }
                
                // Apply shop filter
                if (currentFilters.shop !== 'shop-all') {
                    switch (currentFilters.shop) {
                        case 'shop-jumia':
                            filteredProducts = filteredProducts.filter(product => product.shop.includes('Jumia'));
                            break;
                        case 'shop-kilimall':
                            filteredProducts = filteredProducts.filter(product => product.shop.includes('Kilimall'));
                            break;
                    }
                }
                
                // Apply discount filter
                if (currentFilters.discount !== 'discount-all') {
                    switch (currentFilters.discount) {
                        case 'discount-20':
                            filteredProducts = filteredProducts.filter(product => {
                                const discount = parseInt(product.discount) || 0;
                                return discount >= 20;
                            });
                            break;
                        case 'discount-30':
                            filteredProducts = filteredProducts.filter(product => {
                                const discount = parseInt(product.discount) || 0;
                                return discount >= 30;
                            });
                            break;
                        case 'discount-50':
                            filteredProducts = filteredProducts.filter(product => {
                                const discount = parseInt(product.discount) || 0;
                                return discount >= 50;
                            });
                            break;
                    }
                }
                
                // Apply search filter
                if (currentFilters.search) {
                    filteredProducts = filteredProducts.filter(product => 
                        product.name.toLowerCase().includes(currentFilters.search) ||
                        product.shop.toLowerCase().includes(currentFilters.search)
                    );
                }
                
                // Generate HTML for filtered products
                let productsHTML = '';
                filteredProducts.forEach(product => {
                    // Create image element
                    let imageElement = '';
                    if (product.imageUrl) {
                        imageElement = '<div class="product-image-container"><img src="' + product.imageUrl + '" alt="' + product.name + '" class="product-image" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div class="no-image">No image available</div>\';"></div>';
                    } else {
                        imageElement = '<div class="product-image-container"><div class="no-image">No image available</div></div>';
                    }
                    
                    // Build product HTML
                    productsHTML += '<div class="product" data-category="' + product.category + '" data-price="' + product.currentPrice + '" data-shop="' + product.shop + '">' +
                        imageElement +
                        '<div class="product-content">' +
                        '<div class="category ' + product.category + '">' + product.category.toUpperCase() + '</div>' +
                        '<h3>' + product.name + '</h3>' +
                        '<div class="shop">Shop: ' + product.shop + '</div>' +
                        '<div class="price-container">' +
                        '<span class="price">KES ' + product.currentPrice.toLocaleString() + '</span>';
                    
                    if (product.originalPrice && product.originalPrice > product.currentPrice) {
                        productsHTML += '<span class="original-price">KES ' + product.originalPrice.toLocaleString() + '</span>';
                    }
                    
                    if (product.discount) {
                        productsHTML += '<span class="discount">' + product.discount + ' off</span>';
                    }
                    
                    productsHTML += '</div>';
                    
                    if (product.url) {
                        productsHTML += '<a href="' + product.url + '" class="url" target="_blank">View Deal</a>';
                    }
                    
                    productsHTML += '</div></div>';
                });
                
                // Update products container
                productsContainer.innerHTML = productsHTML;
                
                // Update total deals count
                document.getElementById('total-deals').textContent = filteredProducts.length;
            }
            
            // Initialize filters
            applyFilters();
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