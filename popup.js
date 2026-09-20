/* markdown-minimal popup — open about links in a new tab.
   Links inside an extension popup don't navigate on their own. */
(function () {
  'use strict';
  document.querySelectorAll('a[data-ext]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      chrome.tabs.create({ url: a.href });
    });
  });
})();
