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
  { id: 'mm-copy-page', title: 'Copy page as Markdown', contexts: ['page'] },
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

// Ask the content script to build the markdown AND copy it in the page,
// where clipboard access is reliable. Resolves when the page confirms the
// copy; rejects when there is no content script or the page copy failed.
async function tryPageCopy(info, tab) {
  var res = await chrome.tabs.sendMessage(tab.id, {
    type: 'mm-build',
    menuItemId: info.menuItemId,
    info: {
      linkUrl: info.linkUrl,
      srcUrl: info.srcUrl,
      selectionText: info.selectionText,
    },
  });
  if (res && res.copied) return;
  throw new Error((res && res.error) || 'page copy failed');
}

// Plain-text fallbacks for when the content script can't run (chrome://,
// web store, tabs opened before the extension loaded, …). Copied from the
// worker; less reliable than the page-context copy, but better than nothing.
function buildFallbackMarkdown(info, tab) {
  if (info.menuItemId === 'mm-copy-page') {
    var url = (tab && tab.url) || '';
    if (!url) throw new Error('no url');
    var title = cleanTitle(tab && tab.title) || url;
    return '[' + escapeLinkText(title) + '](' + url + ')';
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

async function workerFallbackCopy(info, tab) {
  var md = buildFallbackMarkdown(info, tab);
  await navigator.clipboard.writeText(md);
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
  tryPageCopy(info, tab)
    .catch(function () {
      return workerFallbackCopy(info, tab);
    })
    .then(function () {
      flashBadge('✓');
    })
    .catch(function () {
      flashBadge('!');
    });
});

// Test seam (not a public API): lets the headless test drive the click flow.
globalThis.__mmTest = {
  tryPageCopy: tryPageCopy,
  buildFallbackMarkdown: buildFallbackMarkdown,
  MENUS: MENUS,
};
