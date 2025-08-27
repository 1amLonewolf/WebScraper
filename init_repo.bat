@echo off
echo Initializing Git repository...
git init
git add .
git commit -m "Initial commit: Kenyan Electronics Deals Scraper"
echo.
echo Repository initialized successfully!
echo.
echo To push to GitHub:
echo 1. Create a new repository on GitHub
echo 2. Run: git remote add origin https://github.com/your-username/your-repo-name.git
echo 3. Run: git push -u origin main
echo.
echo To enable GitHub Pages:
echo 1. Go to your repository settings on GitHub
echo 2. Scroll down to the "Pages" section
echo 3. Under "Source", select "Deploy from a branch"
echo 4. Select "main" branch and "/docs" folder
echo 5. Click "Save"
pause