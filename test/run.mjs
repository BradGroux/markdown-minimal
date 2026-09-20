/* markdown-minimal — browser tests.
 * Runs md.js + context.js in real headless Chromium (real DOM, real code)
 * and drives the actual chrome.runtime.onMessage path the background uses.
 */
import { createRequire } from 'module';
import path from 'path';
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
async function checkThrows(name, fn) {
  try {
    await fn();
    failures++;
    console.log('FAIL -', name, '(did not throw)');
  } catch (e) {
    console.log('ok   -', name, '(threw)');
  }
}

const browser = await chromium.launch({ executablePath: SHELL });
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__capturedListeners = [];
  window.chrome = {
    runtime: {
      onMessage: {
        addListener: (fn) => window.__capturedListeners.push(fn),
      },
    },
  };
});
await page.goto(
  'data:text/html,' +
    encodeURIComponent('<html><body><div id="t"></div></body></html>')
);
await page.addScriptTag({ path: path.join(DIR, 'md.js') });
await page.addScriptTag({ path: path.join(DIR, 'context.js') });

const conv = (html) =>
  page.evaluate((h) => window.MarkdownMinimal.convertHTML(h), html);
const build = (menu, last, info) =>
  page.evaluate(
    ([m, l, i]) => window.MarkdownMinimal.build(m, l, i),
    [menu, last, info]
  );
// Drive the REAL message-listener path the background worker uses.
const viaMessage = (menuItemId, info) =>
  page.evaluate(
    ([m, i]) =>
      new Promise((res) =>
        window.__capturedListeners[0](
          { type: 'mm-build', menuItemId: m, info: i || {} },
          {},
          res
        )
      ),
    [menuItemId, info]
  );

// --- converter fixtures ---
check(
  'link',
  await conv('<p>See <a href="https://example.com">Example</a> now.</p>'),
  'See [Example](https://example.com/) now.'
);
check(
  'inline formatting',
  await conv(
    '<p><strong>bold</strong> and <em>italic</em> and <code>code</code> and <del>gone</del></p>'
  ),
  '**bold** and *italic* and `code` and ~~gone~~'
);
check(
  'heading + paragraph',
  await conv('<h2>Title</h2><p>Body text.</p>'),
  '## Title\n\nBody text.'
);
check(
  'unordered list',
  await conv('<ul><li>one</li><li>two</li></ul>'),
  '- one\n- two'
);
check(
  'ordered list',
  await conv('<ol><li>first</li><li>second</li></ol>'),
  '1. first\n2. second'
);
check(
  'nested list',
  await conv('<ul><li>one<ul><li>sub</li></ul></li><li>two</li></ul>'),
  '- one\n  - sub\n- two'
);
check(
  'code block with language',
  await conv('<pre><code class="language-js">const x = 1;</code></pre>'),
  '```js\nconst x = 1;\n```'
);
check(
  'blockquote',
  await conv('<blockquote><p>say it</p></blockquote>'),
  '> say it'
);
check(
  'table',
  await conv(
    '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>'
  ),
  '| A | B |\n| --- | --- |\n| 1 | 2 |'
);
check(
  'image',
  await conv('<p><img src="https://example.com/i.png" alt="pic"></p>'),
  '![pic](https://example.com/i.png)'
);
check(
  'script stripped',
  await conv('<p>hi</p><script>alert(1)</script>'),
  'hi'
);
check(
  'whitespace between inline nodes',
  await conv('<p>foo   <b>bar</b>   baz</p>'),
  'foo **bar** baz'
);
check('hr', await conv('<p>a</p><hr><p>b</p>'), 'a\n\n---\n\nb');

// --- build() unit paths ---
check(
  'build link with text',
  await build(
    'mm-copy-link',
    { linkUrl: 'https://example.com', linkText: 'Example' },
    {}
  ),
  '[Example](https://example.com)'
);
check(
  'build link without text falls back to url',
  await build('mm-copy-link', { linkUrl: 'https://example.com', linkText: '' }, {}),
  '[https://example.com](https://example.com)'
);
await checkThrows('javascript: href refused', () =>
  build('mm-copy-link', { linkUrl: 'javascript:alert(1)', linkText: 'x' }, {})
);
check(
  'build image',
  await build(
    'mm-copy-image',
    { imgSrc: 'https://example.com/i.png', imgAlt: 'pic' },
    {}
  ),
  '![pic](https://example.com/i.png)'
);
check(
  'build selection from HTML',
  await build('mm-copy-selection', { selectionHTML: '<p><strong>hi</strong></p>' }, {}),
  '**hi**'
);
check(
  'build selection falls back to plain text',
  await build('mm-copy-selection', { selectionHTML: null }, { selectionText: 'plain' }),
  'plain'
);
await checkThrows('empty selection throws', () =>
  build('mm-copy-selection', { selectionHTML: null }, {})
);

// --- real contextmenu + message-listener path ---
await page.evaluate(() => {
  document.getElementById('t').innerHTML =
    '<p>Read <a id="lk" href="https://example.com/docs">the docs</a> today.</p>' +
    '<p id="sel">Select <strong>this</strong> text.</p>';
});
await page.evaluate(() => {
  document
    .getElementById('lk')
    .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
});
let r = await viaMessage('mm-copy-link', {});
check('message path: link', r.markdown, '[the docs](https://example.com/docs)');

await page.evaluate(() => {
  const p = document.getElementById('sel');
  const range = document.createRange();
  range.selectNodeContents(p);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  p.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
});
r = await viaMessage('mm-copy-selection', {});
check('message path: selection', r.markdown, 'Select **this** text.');

// --- page path: full contents as Markdown, site chrome stripped ---
await page.evaluate(() => {
  document.title = 'Fixture Page';
  document.getElementById('t').innerHTML =
    '<nav><a href="/x">skip me</a></nav>' +
    '<header>skip me too</header>' +
    '<h1>Real heading</h1><p>Real <strong>body</strong>.</p>' +
    '<footer>skip footer</footer>';
});
r = await viaMessage('mm-copy-page', {});
check(
  'message path: page',
  r.markdown,
  '# Fixture Page\n\n# Real heading\n\nReal **body**.'
);

await browser.close();
if (failures) {
  console.log(failures + ' FAILURES');
  process.exit(1);
}
console.log('all browser tests passed');
