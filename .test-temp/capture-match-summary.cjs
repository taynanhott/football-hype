const { chromium } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/tayna/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  await page.goto(pathToFileURL(path.resolve('.test-temp/match-summary-preview.html')).href);
  await page.screenshot({ path: '.test-temp/match-summary-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.test-temp/match-summary-mobile.png', fullPage: true });
  console.log('Mobile horizontal overflow:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await browser.close();
})();
