/* Rasterize icons/icon.svg to PNGs via headless Chromium. */
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
  const page = await browser.newPage();
  for (const size of [128, 48, 16]) {
    await page.setViewportSize({ width: size, height: size });
    await page.goto('file://' + path.join(dir, 'icons', 'icon.svg'));
    // SVG fills the viewport exactly; screenshot the page.
    const buf = await page.screenshot({ omitBackground: false });
    fs.writeFileSync(path.join(dir, 'icons', `icon${size}.png`), buf);
    console.log(`icon${size}.png`, buf.length, 'bytes');
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
