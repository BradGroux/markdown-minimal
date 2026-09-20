/* markdown-minimal — background worker tests (Node, stubbed chrome APIs).
 * Drives the real onInstalled / onClicked handlers from background.js.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const created = [];
let installedHandler = null;
let clickHandler = null;
const sentMessages = [];
let sendMessageImpl = async () => {
  throw new Error('no content script');
};
let clipboard = null;
const badges = [];

globalThis.chrome = {
  runtime: {
    onInstalled: {
      addListener: (fn) => {
        installedHandler = fn;
      },
    },
  },
  contextMenus: {
    create: (m) => created.push(m),
    onClicked: {
      addListener: (fn) => {
        clickHandler = fn;
      },
    },
  },
  tabs: {
    sendMessage: async (tabId, msg) => {
      sentMessages.push({ tabId, msg });
      return sendMessageImpl(msg);
    },
  },
  action: {
    setBadgeText: ({ text }) => badges.push(['text', text]),
    setBadgeBackgroundColor: ({ color }) => badges.push(['color', color]),
  },
};
Object.defineProperty(globalThis, 'navigator', {
  value: {
    clipboard: {
      writeText: async (t) => {
        clipboard = t;
      },
    },
  },
  configurable: true,
});

const code = readFileSync(path.join(DIR, 'background.js'), 'utf8');
eval(code);

const flush = () => new Promise((r) => setTimeout(r, 30));

// --- install registers the four menus ---
await installedHandler();
check('four menus registered', created.length, 4);
check(
  'menu ids',
  created.map((m) => m.id).join(','),
  'mm-copy-link,mm-copy-image,mm-copy-selection,mm-copy-page'
);
check(
  'selection menu contexts',
  created.find((m) => m.id === 'mm-copy-selection').contexts.join(','),
  'selection'
);

// --- page link needs no content script ---
clipboard = null;
await clickHandler(
  { menuItemId: 'mm-copy-page' },
  { id: 7, title: 'My Page', url: 'https://example.com/p' }
);
await flush();
check('page link copied', clipboard, '[My Page](https://example.com/p)');
check(
  'badge flashed ok',
  badges.some((b) => b[0] === 'text' && b[1] === '✓'),
  true
);

// --- selection via content script ---
clipboard = null;
sentMessages.length = 0;
sendMessageImpl = async () => ({ markdown: '**hi**' });
await clickHandler(
  { menuItemId: 'mm-copy-selection', selectionText: 'hi' },
  { id: 7 }
);
await flush();
check('selection markdown copied', clipboard, '**hi**');
check('message sent to tab', sentMessages[0].tabId, 7);
check(
  'message type',
  sentMessages[0].msg.type + ':' + sentMessages[0].msg.menuItemId,
  'mm-build:mm-copy-selection'
);

// --- link falls back when content script is missing ---
clipboard = null;
sendMessageImpl = async () => {
  throw new Error('no content script');
};
await clickHandler(
  { menuItemId: 'mm-copy-link', linkUrl: 'https://example.com/x' },
  { id: 7 }
);
await flush();
check(
  'link fallback copied',
  clipboard,
  '[https://example.com/x](https://example.com/x)'
);

// --- image falls back when content script is missing ---
clipboard = null;
await clickHandler(
  { menuItemId: 'mm-copy-image', srcUrl: 'https://example.com/i.png' },
  { id: 7 }
);
await flush();
check('image fallback copied', clipboard, '![](https://example.com/i.png)');

// --- total failure flashes "!" and writes nothing ---
clipboard = null;
const badgeCount = badges.length;
await clickHandler({ menuItemId: 'mm-copy-link' }, { id: 7 });
await flush();
check('nothing copied on failure', clipboard, null);
check(
  'badge flashed error',
  badges.slice(badgeCount).some((b) => b[0] === 'text' && b[1] === '!'),
  true
);

if (failures) {
  console.log(failures + ' FAILURES');
  process.exit(1);
}
console.log('all background tests passed');
