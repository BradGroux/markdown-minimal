/* markdown-minimal — records what was right-clicked so the background
   worker can build Markdown for it. Runs in page context. */

(function () {
  'use strict';

  var last = null;

  function selectionHTML() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var div = document.createElement('div');
    for (var i = 0; i < sel.rangeCount; i++) {
      div.appendChild(sel.getRangeAt(i).cloneContents());
    }
    return div.innerHTML;
  }

  document.addEventListener(
    'contextmenu',
    function (e) {
      var t = e.target;
      var a = t && t.closest ? t.closest('a[href]') : null;
      var img = t && t.closest ? t.closest('img') : null;
      last = {
        linkUrl: a ? a.href : null,
        linkText: a ? (a.innerText || '').trim() : null,
        imgSrc: img ? img.currentSrc || img.src : null,
        imgAlt: img ? img.alt || '' : null,
        selectionHTML: selectionHTML(),
      };
    },
    true
  );

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'mm-build') {
      try {
        sendResponse({
          markdown: window.MarkdownMinimal.build(
            msg.menuItemId,
            last,
            msg.info
          ),
        });
      } catch (err) {
        sendResponse({ error: String((err && err.message) || err) });
      }
    }
    return false;
  });
})();
