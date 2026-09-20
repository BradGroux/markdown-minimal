/* markdown-minimal — popup tests (real headless Chromium).
 * Verifies the about links open via chrome.tabs.create and the manifest
 * actually points the toolbar button at popup.html.
 */
import { createRequire } from 'module';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.HOME + '/workspace/solutionmeld-work/node_modules/playwright-core'
);

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL =
  process.env.HOME +
  '/.cache/ms-playwright/chromium-1200/chrome-headless-shell-linux64/chrome-headless-shell';

let failures = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    console.log('ok   -', name);
  } else {
    failures++;
    console.log('FAIL -', name);
    console.log('  expected:', JSON.stringify(expected));
    console.log('  actual:  ', JSON.stringify(actual));
  }
}

// --- manifest wires the popup ---
const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
check('manifest default_popup', manifest.action.default_popup, 'popup.html');

// --- about links open in a new tab ---
const browser = await chromium.launch({
  executablePath: SHELL,
});
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__opened = [];
  window.chrome = {
    tabs: {
      create: (opts) => {
        window.__opened.push(opts.url);
      },
    },
  };
});
await page.goto('file://' + path.join(DIR, 'popup.html'));

const links = await page.$$eval('a[data-ext]', (as) =>
  as.map((a) => ({ text: a.textContent, href: a.href }))
);
check(
  'about links',
  links.map((l) => l.text + '=' + l.href).join(' | '),
  'Brad Groux=https://twitter.com/bradgroux | ' +
    'Digital Meld=https://go.sstb.ai/extensions | ' +
    'SSTB.ai community=https://go.sstb.ai/markdown-minimal'
);

for (const i of [0, 1, 2]) {
  await page.$$eval(
    'a[data-ext]',
    (as, idx) => as[idx].click(),
    i
  );
}
const opened = await page.evaluate(() => window.__opened);
check('tabs.create calls', opened.join(' | '), links.map((l) => l.href).join(' | '));
check('no navigation happened', page.url(), 'file://' + path.join(DIR, 'popup.html'));

await browser.close();
if (failures) {
  console.log(failures + ' FAILURES');
  process.exit(1);
}
console.log('all popup tests passed');
