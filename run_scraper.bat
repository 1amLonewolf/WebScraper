@echo off
echo Kenyan Electronics Deals Scraper
echo ===============================
echo.
echo Running scraper...
node comprehensive_scraper.js
echo.
echo Opening report...
node open_report.js
echo.
echo Done! Check your browser for the report.
pause