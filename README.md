# Kenyan Electronics Deals Scraper

[![View Live Site](https://img.shields.io/badge/View-Live%20Site-blue?style=for-the-badge&logo=google-chrome)](https://1amlonewolf.github.io/WebScraper/)
[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-green?style=for-the-badge&logo=github)](https://1amlonewolf.github.io/WebScraper/)

A web scraper that finds flash sales and special offers for phones and laptops under 10,000 KES from popular Kenyan online shops.

## 🌐 Live Site

**Visit the live site:** https://1amlonewolf.github.io/WebScraper/

## Features

- Scrapes multiple Kenyan online shops (Jumia Kenya, Kilimall Kenya) for flash sales and special offers
- Filters results for phones and laptops under 10,000 KES
- Generates a JSON file with all found deals
- Creates an interactive HTML report for easy viewing
- Removes duplicate items
- Automated daily updates via GitHub Actions
- Hosted on GitHub Pages

## How It Works

This project uses GitHub Actions to automatically scrape Kenyan online shops daily for electronics deals. The workflow runs every day at 8:00 AM UTC (11:00 AM EAT) and updates the data on GitHub Pages.

The HTML report includes:
- Product images, prices, and discount information
- Direct links to products on the store websites
- Responsive design that works on mobile and desktop

## Setup Instructions

### For Local Development

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the scraper:
   ```
   npm run scrape
   ```
4. View the results:
   ```
   npm run view
   ```

### For GitHub Pages Hosting

1. Fork this repository
2. Go to your repository settings
3. Scroll down to the "Pages" section
4. Under "Source", select "Deploy from a branch"
5. Select "main" branch and "/docs" folder
6. Click "Save"
7. The site will be available at `https://your-username.github.io/your-repo-name/`

### Customizing the Scraper

You can modify the following variables in `comprehensive_scraper.js`:
- `MAX_PRICE`: Change the maximum price threshold
- `SHOPS`: Add or modify shops to scrape
- Category detection keywords in `determineCategory()`

## Project Structure

```
.
├── comprehensive_scraper.js     # Main scraper script
├── view_report.js               # Script to open HTML report
├── package.json                 # Project dependencies and scripts
├── docs/                        # GitHub Pages hosting directory
│   ├── index.html               # Generated HTML report
│   └── kenyan_electronics_deals.json  # Raw JSON data
└── .github/workflows/           # GitHub Actions workflows
    └── daily_scraper.yml        # Daily scraping workflow
```

## Available Scripts

- `npm run scrape` - Run the scraper manually
- `npm run view` - Open the HTML report in your browser

## Data Files

- `docs/kenyan_electronics_deals.json` - Raw JSON data with all scraped deals
- `docs/index.html` - Generated HTML report

## Technologies Used

- Node.js
- Axios (for HTTP requests)
- Cheerio (for HTML parsing)
- GitHub Actions (for automation)
- GitHub Pages (for hosting)

## Contributing

Contributions are welcome! Feel free to:
- Add support for more Kenyan online shops
- Improve the accuracy of product categorization
- Enhance the HTML report design
- Fix any issues or bugs

## Legal Notice

This scraper is for educational purposes only. Please respect the terms of service of the websites you scrape. The authors are not responsible for any misuse of this code.

## License

This project is licensed under the MIT License.