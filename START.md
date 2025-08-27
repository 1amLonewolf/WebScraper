# Kenyan Electronics Deals Scraper

Welcome to the Kenyan Electronics Deals Scraper project! This tool automatically finds flash sales and special offers for phones and laptops under 10,000 KES from popular Kenyan online shops.

## Quick Start

1. Install dependencies:
   ```
   npm install
   ```

2. Run the scraper:
   ```
   npm run scrape
   ```

3. View the results:
   ```
   npm run view
   ```

## GitHub Pages Setup

To host this project on GitHub Pages:

1. Fork this repository
2. Go to your repository settings
3. Scroll down to the "Pages" section
4. Under "Source", select "Deploy from a branch"
5. Select "main" branch and "/docs" folder
6. Click "Save"
7. The site will be available at `https://your-username.github.io/your-repo-name/`

The scraper will automatically run daily and update the data on your GitHub Pages site.

## Files

- `comprehensive_scraper.js` - Main scraper script
- `docs/index.html` - Generated HTML report
- `docs/kenyan_electronics_deals.json` - Raw JSON data
- `.github/workflows/daily_scraper.yml` - GitHub Actions workflow for daily updates

## Customization

You can modify the price limit, shops to scrape, and category detection in `comprehensive_scraper.js`.