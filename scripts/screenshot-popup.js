/* Screenshot popup.html for the README (docs/images/popup.png). */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = path.resolve(__dirname, '..');
  const browser = await chromium.launch({
    executablePath:
      process.env.HOME +
      '/.cache/ms-playwright/chromium-1200/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 300, height: 400 } });
  await page.goto('file://' + path.join(dir, 'popup.html'));
  await page.waitForTimeout(300);
  const app = await page.$('#app');
  const buf = await app.screenshot();
  const out = path.join(dir, 'docs', 'images');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'popup.png'), buf);
  console.log('popup.png', buf.length, 'bytes');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
