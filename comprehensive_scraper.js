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
  const escapedData = JSON.stringify(data).replace(/</g, '\u003c').replace(/>/g, '\u003e');
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kenyan Electronics Deals Under 10,000 KES</title>
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
            justify-content: center;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        
        .filter-btn {
            padding: 12px 25px;
            background: white;
            border: 2px solid #4361ee;
            border-radius: 30px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            font-size: 1rem;
            color: #4361ee;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .filter-btn:hover {
            background: #4361ee;
            color: white;
            transform: translateY(-3px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
        }
        
        .filter-btn.active {
            background: #4361ee;
            color: white;
            box-shadow: 0 4px 8px rgba(67, 97, 238, 0.3);
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
                <div class="summary-value" id="total-deals">0</div>
                <div class="summary-label">Total Deals</div>
                <div class="last-updated">Last updated: <span id="timestamp">Loading...</span></div>
            </div>
            <div class="summary-item">
                <div class="summary-value" id="laptop-deals">0</div>
                <div class="summary-label">Laptop Deals</div>
            </div>
            <div class="summary-item">
                <div class="summary-value" id="phone-deals">0</div>
                <div class="summary-label">Phone Deals</div>
            </div>
        </div>
        
        <div class="controls">
            <button class="filter-btn active" data-filter="all">All Deals</button>
            <button class="filter-btn" data-filter="laptop">Laptops</button>
            <button class="filter-btn" data-filter="phone">Phones</button>
        </div>
        
        <div id="loading" class="loading">Loading amazing deals</div>
        <div id="error" class="error-message" style="display: none;"></div>
        <div class="products" id="products-container">
            <!-- Products will be inserted here -->
        </div>
        
        <footer>
            <p>Data refreshed daily • Last scrape: <span id="footer-timestamp">Loading...</span></p>
            <p>Deals from Jumia Kenya and other Kenyan online shops</p>
        </footer>
    </div>

    <script>
        // Embedded data
        const data = ${escapedData};
        
        // Format timestamp for display
        function formatTimestamp(timestamp) {
            try {
                const date = new Date(timestamp);
                return date.toLocaleString('en-KE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                console.error('Error formatting timestamp:', e);
                return 'Unknown';
            }
        }
        
        // Calculate statistics
        function calculateStats(items) {
            const laptopDeals = items.filter(item => item.category === 'laptop').length;
            const phoneDeals = items.filter(item => item.category === 'phone').length;
            
            // Calculate average discount
            let totalDiscount = 0;
            let discountCount = 0;
            
            items.forEach(item => {
                if (item.discount && item.discount !== '') {
                    const discountValue = parseInt(item.discount);
                    if (!isNaN(discountValue)) {
                        totalDiscount += discountValue;
                        discountCount++;
                    }
                }
            });
            
            const avgDiscount = discountCount > 0 ? Math.round(totalDiscount / discountCount) : 0;
            
            return {
                laptopDeals,
                phoneDeals,
                avgDiscount
            };
        }
        
        // Display the data
        document.addEventListener('DOMContentLoaded', function() {
            try {
                // Hide loading message
                document.getElementById('loading').style.display = 'none';
                
                // Update summary information
                document.getElementById('timestamp').textContent = formatTimestamp(data.timestamp);
                document.getElementById('footer-timestamp').textContent = formatTimestamp(data.timestamp);
                document.getElementById('total-deals').textContent = data.totalItems;
                
                // Calculate and display stats
                const stats = calculateStats(data.items);
                document.getElementById('laptop-deals').textContent = stats.laptopDeals;
                document.getElementById('phone-deals').textContent = stats.phoneDeals;
                
                // Display products
                const container = document.getElementById('products-container');
                
                if (!data.items || data.items.length === 0) {
                    container.innerHTML = '<p class="error-message">No deals found.</p>';
                    return;
                }
                
                data.items.forEach(product => {
                    try {
                        const productDiv = document.createElement('div');
                        productDiv.className = 'product';
                        productDiv.dataset.category = product.category;
                        
                        // Create image element
                        let imageElement = '';
                        if (product.imageUrl) {
                            imageElement = '<div class="product-image-container"><img src="' + product.imageUrl + '" alt="' + product.name + '" class="product-image" onerror="this.onerror=null;this.parentElement.innerHTML='No image available';"></div>';
                        } else {
                            imageElement = '<div class="product-image-container"><div class="no-image">No image available</div></div>';
                        }
                        
                        let productHTML = imageElement +
                            '<div class="product-content">' +
                            '<div class="category ' + product.category + '">' + product.category.toUpperCase() + '</div>' +
                            '<h3>' + product.name + '</h3>' +
                            '<div class="shop">Shop: ' + product.shop + '</div>' +
                            '<div class="price-container">' +
                            '<span class="price">KES ' + product.currentPrice.toLocaleString() + '</span>';
                        
                        if (product.originalPrice && product.originalPrice > product.currentPrice) {
                            productHTML += '<span class="original-price">KES ' + product.originalPrice.toLocaleString() + '</span>';
                        }
                        
                        if (product.discount) {
                            productHTML += '<span class="discount">' + product.discount + ' off</span>';
                        }
                        
                        productHTML += '</div>';
                        
                        if (product.url) {
                            productHTML += '<a href="' + product.url + '" class="url" target="_blank">View Deal</a>';
                        }
                        
                        productHTML += '</div>'; // Close product-content
                        
                        productDiv.innerHTML = productHTML;
                        container.appendChild(productDiv);
                    } catch (e) {
                        console.error('Error processing product:', e);
                    }
                });
                
                // Add filter functionality
                const filterButtons = document.querySelectorAll('.filter-btn');
                filterButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        // Update active button
                        filterButtons.forEach(btn => btn.classList.remove('active'));
                        this.classList.add('active');
                        
                        // Filter products
                        const filter = this.dataset.filter;
                        const products = document.querySelectorAll('.product');
                        
                        products.forEach(product => {
                            if (filter === 'all' || product.dataset.category === filter) {
                                product.style.display = 'flex';
                            } else {
                                product.style.display = 'none';
                            }
                        });
                    });
                });
            } catch (e) {
                // Hide loading message and show error
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = 'Error loading deals: ' + e.message;
                console.error('Error displaying data:', e);
            }
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