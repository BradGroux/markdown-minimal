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
      var md;
      try {
        md = window.MarkdownMinimal.build(msg.menuItemId, last, msg.info);
      } catch (err) {
        sendResponse({ error: String((err && err.message) || err) });
        return false;
      }
      // Copy here in the page, where clipboard access is reliable, and
      // report back whether it landed.
      copyText(md).then(
        function () {
          sendResponse({ markdown: md, copied: true });
        },
        function (err) {
          sendResponse({
            markdown: md,
            copied: false,
            error: String((err && err.message) || err),
          });
        }
      );
      return true; // async sendResponse
    }
    return false;
  });

  // navigator.clipboard first; textarea + execCommand as the fallback
  // (needs no user gesture).
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return execCopy(text);
      });
    }
    return execCopy(text);
  }

  function execCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = null;
      try {
        ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        if (document.execCommand('copy')) resolve();
        else reject(new Error('execCommand copy returned false'));
      } catch (e) {
        reject(e);
      } finally {
        if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
      }
    });
  }
})();
