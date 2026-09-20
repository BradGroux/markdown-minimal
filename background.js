/* markdown-minimal — background service worker.
   Registers context menus, builds Markdown via the page, copies it. */

'use strict';

var MENUS = [
  { id: 'mm-copy-link', title: 'Copy link as Markdown', contexts: ['link'] },
  { id: 'mm-copy-image', title: 'Copy image as Markdown', contexts: ['image'] },
  {
    id: 'mm-copy-selection',
    title: 'Copy selection as Markdown',
    contexts: ['selection'],
  },
  { id: 'mm-copy-page', title: 'Copy page link as Markdown', contexts: ['page'] },
];

chrome.runtime.onInstalled.addListener(function () {
  MENUS.forEach(function (m) {
    chrome.contextMenus.create({ id: m.id, title: m.title, contexts: m.contexts });
  });
});

function cleanTitle(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeLinkText(s) {
  return cleanTitle(s).replace(/\]/g, '\\]');
}

// Resolve the markdown for a menu click. Page-context is handled here
// directly (tab title/url need no page script); everything else goes
// through the content script, with plain-text fallbacks for pages where
// content scripts can't run (chrome://, file://, web store, …).
async function buildMarkdown(info, tab) {
  if (info.menuItemId === 'mm-copy-page') {
    var url = (tab && tab.url) || '';
    if (!url) throw new Error('no url');
    var title = cleanTitle(tab && tab.title) || url;
    return '[' + escapeLinkText(title) + '](' + url + ')';
  }
  try {
    var res = await chrome.tabs.sendMessage(tab.id, {
      type: 'mm-build',
      menuItemId: info.menuItemId,
      info: {
        linkUrl: info.linkUrl,
        srcUrl: info.srcUrl,
        selectionText: info.selectionText,
      },
    });
    if (res && res.markdown) return res.markdown;
    throw new Error((res && res.error) || 'no markdown');
  } catch (e) {
    // fallbacks when the content script is unavailable
  }
  if (info.menuItemId === 'mm-copy-link' && info.linkUrl) {
    return '[' + escapeLinkText(info.linkUrl) + '](' + info.linkUrl + ')';
  }
  if (info.menuItemId === 'mm-copy-image' && info.srcUrl) {
    return '![](' + info.srcUrl + ')';
  }
  if (info.menuItemId === 'mm-copy-selection' && info.selectionText) {
    return cleanTitle(info.selectionText);
  }
  throw new Error('nothing to copy');
}

function flashBadge(text) {
  try {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
    setTimeout(function () {
      chrome.action.setBadgeText({ text: '' });
    }, 900);
  } catch (e) {
    /* headless / no action UI */
  }
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  buildMarkdown(info, tab)
    .then(function (md) {
      return navigator.clipboard.writeText(md);
    })
    .then(function () {
      flashBadge('✓');
    })
    .catch(function () {
      flashBadge('!');
    });
});

// Test seam (not a public API): lets the headless test drive the click flow.
globalThis.__mmTest = { buildMarkdown: buildMarkdown, MENUS: MENUS };
