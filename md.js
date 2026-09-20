/* markdown-minimal — tiny HTML → Markdown converter. Runs in page context. */

(function () {
  'use strict';

  function cleanText(s) {
    return String(s == null ? '' : s).replace(/[\u00a0\s]+/g, ' ').trim();
  }

  // Collapse internal whitespace but keep a single leading/trailing space
  // when the original had it, so "foo <b>bar</b>" doesn't become "foo**bar**".
  function smartSpace(s) {
    var src = String(s == null ? '' : s);
    var lead = /^\s/.test(src) ? ' ' : '';
    var trail = /\s$/.test(src) ? ' ' : '';
    var core = src.replace(/\s+/g, ' ').trim();
    return core ? lead + core + trail : '';
  }

  function escapeLinkText(s) {
    return cleanText(s).replace(/\]/g, '\\]');
  }

  function fenceFor(code) {
    return code.indexOf('```') === -1 ? '```' : '````';
  }

  function inlineCode(text) {
    var t = String(text).replace(/\n/g, ' ');
    if (t.indexOf('`') === -1) return '`' + t + '`';
    return '`` ' + t + ' ``';
  }

  function childrenInline(node, ctx) {
    var out = '';
    Array.prototype.forEach.call(node.childNodes, function (n) {
      out += inlineNode(n, ctx);
    });
    return out;
  }

  function inlineNode(node, ctx) {
    if (node.nodeType === 3) {
      return ctx.inPre ? node.nodeValue : smartSpace(node.nodeValue);
    }
    if (node.nodeType !== 1) return '';
    var tag = node.tagName.toLowerCase();
    switch (tag) {
      case 'script':
      case 'style':
      case 'noscript':
      case 'template':
        return '';
      case 'br':
        return '\n';
      case 'a': {
        var href = node.getAttribute('href') || '';
        var text = cleanText(childrenInline(node, ctx));
        if (!href || /^javascript:/i.test(href)) return text;
        href = node.href || href;
        if (!text) return href;
        return '[' + escapeLinkText(text) + '](' + href + ')';
      }
      case 'strong':
      case 'b': {
        var b = cleanText(childrenInline(node, ctx));
        return b ? '**' + b + '**' : '';
      }
      case 'em':
      case 'i': {
        var em = cleanText(childrenInline(node, ctx));
        return em ? '*' + em + '*' : '';
      }
      case 'code': {
        var c = childrenInline(node, ctx);
        return c ? inlineCode(c) : '';
      }
      case 'img': {
        var alt = node.getAttribute('alt') || '';
        var src = node.currentSrc || node.src || '';
        return src ? '![' + cleanText(alt) + '](' + src + ')' : '';
      }
      case 'del':
      case 's':
      case 'strike': {
        var d = cleanText(childrenInline(node, ctx));
        return d ? '~~' + d + '~~' : '';
      }
      default:
        return childrenInline(node, ctx);
    }
  }

  function blockChildren(node, ctx) {
    var parts = [];
    Array.prototype.forEach.call(node.childNodes, function (n) {
      var md = blockNode(n, ctx);
      if (md) parts.push(md);
    });
    return parts.join('\n\n');
  }

  function isBlockTag(tag) {
    return /^(p|div|section|article|header|footer|main|figure|figcaption|aside|nav|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|pre|hr|table|thead|tbody|tr|td|th)$/.test(
      tag
    );
  }

  // Flow content: group consecutive inline nodes into one paragraph run,
  // let block nodes stand alone. Used for <div>-style containers so that
  // "See <a>x</a> now." doesn't get split across blank lines.
  function flowChildren(node, ctx) {
    var parts = [];
    var inlineRun = [];
    function flushInline() {
      var s = inlineRun.join('').trim();
      if (s) parts.push(s);
      inlineRun = [];
    }
    Array.prototype.forEach.call(node.childNodes, function (n) {
      var tag = n.nodeType === 1 ? n.tagName.toLowerCase() : '';
      if (n.nodeType === 3 || !isBlockTag(tag)) {
        inlineRun.push(inlineNode(n, ctx));
      } else {
        flushInline();
        var md = blockNode(n, ctx);
        if (md) parts.push(md);
      }
    });
    flushInline();
    return parts.join('\n\n');
  }

  function listToMd(node, ctx, ordered) {
    var items = [];
    var idx = 0;
    var depth = ctx.listDepth || 0;
    Array.prototype.forEach.call(node.childNodes, function (li) {
      if (li.nodeType !== 1 || li.tagName.toLowerCase() !== 'li') return;
      idx++;
      var bullet = ordered ? idx + '. ' : '- ';
      var parts = [];
      var inlineRun = [];
      function flushInline() {
        var s = inlineRun.join('').trim();
        if (s) parts.push(s);
        inlineRun = [];
      }
      Array.prototype.forEach.call(li.childNodes, function (n) {
        var tag = n.nodeType === 1 ? n.tagName.toLowerCase() : '';
        if (tag === 'ul' || tag === 'ol') {
          flushInline();
          parts.push(blockNode(n, { listDepth: depth + 1, inPre: false }));
        } else if (n.nodeType === 3 || !isBlockTag(tag)) {
          inlineRun.push(inlineNode(n, ctx));
        } else {
          flushInline();
          var md = blockNode(n, ctx);
          if (md) parts.push(md);
        }
      });
      flushInline();
      // blank line between block parts, single newline into a nested list
      var text = parts
        .join('\n\n')
        .replace(/\n\n(?=(?:[-*]|\d+\.) )/g, '\n');
      var indent = '  ';
      var lines = text.split('\n');
      var rest = lines
        .slice(1)
        .map(function (l) {
          return l ? indent + l : l;
        })
        .join('\n');
      items.push(bullet + lines[0] + (rest ? '\n' + rest : ''));
    });
    return items.join('\n');
  }

  function tableToMd(node, ctx) {
    var rows = [];
    Array.prototype.forEach.call(node.querySelectorAll('tr'), function (tr) {
      if (tr.closest('table') !== node) return; // skip nested tables
      var cells = [];
      Array.prototype.forEach.call(tr.childNodes, function (c) {
        if (c.nodeType === 1 && /^(th|td)$/i.test(c.tagName)) {
          cells.push(
            cleanText(childrenInline(c, ctx)).replace(/\|/g, '\\|')
          );
        }
      });
      if (cells.length) rows.push('| ' + cells.join(' | ') + ' |');
    });
    if (!rows.length) return blockChildren(node, ctx);
    var colCount = (rows[0].match(/\|/g) || []).length - 1;
    var dashes = [];
    for (var i = 0; i < colCount; i++) dashes.push('---');
    var sep = '| ' + dashes.join(' | ') + ' |';
    rows.splice(1, 0, sep);
    return rows.join('\n');
  }

  function blockNode(node, ctx) {
    if (node.nodeType === 3) {
      return smartSpace(node.nodeValue);
    }
    if (node.nodeType !== 1) return '';
    var tag = node.tagName.toLowerCase();
    switch (tag) {
      case 'script':
      case 'style':
      case 'noscript':
      case 'template':
        return '';
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        var level = parseInt(tag.charAt(1), 10);
        var hashes = '';
        for (var i = 0; i < level; i++) hashes += '#';
        return hashes + ' ' + cleanText(childrenInline(node, ctx));
      }
      case 'p':
        return cleanText(childrenInline(node, ctx));
      case 'div':
      case 'section':
      case 'article':
      case 'header':
      case 'footer':
      case 'main':
      case 'figure':
      case 'figcaption':
      case 'aside':
      case 'nav':
        return flowChildren(node, ctx);
      case 'blockquote': {
        var inner = flowChildren(node, ctx);
        return inner
          .split('\n')
          .map(function (l) {
            return '> ' + l;
          })
          .join('\n');
      }
      case 'pre': {
        var codeEl = node.querySelector('code');
        var lang = '';
        if (codeEl) {
          var m = (codeEl.className || '').match(/language-([\w-]+)/);
          if (m) lang = m[1];
        }
        var code = node.textContent.replace(/\n+$/, '');
        var fence = fenceFor(code);
        return fence + lang + '\n' + code + '\n' + fence;
      }
      case 'hr':
        return '---';
      case 'br':
        return '';
      case 'ul':
        return listToMd(node, ctx, false);
      case 'ol':
        return listToMd(node, ctx, true);
      case 'table':
        return tableToMd(node, ctx);
      default:
        // inline-level tags fall back to inline conversion
        if (
          /^(a|span|strong|b|em|i|code|img|small|abbr|time|label|del|s|u|sub|sup|kbd)$/.test(
            tag
          )
        ) {
          return inlineNode(node, ctx);
        }
        return blockChildren(node, ctx);
    }
  }

  function convertHTML(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var md = flowChildren(tpl.content, { listDepth: 0, inPre: false });
    return md
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Build the markdown string for a context-menu action.
  // menuItemId: mm-copy-link | mm-copy-image | mm-copy-selection
  // last: recorded contextmenu data (may be null); info: fallback from onClicked
  function build(menuItemId, last, info) {
    info = info || {};
    if (menuItemId === 'mm-copy-link') {
      var href = (last && last.linkUrl) || info.linkUrl || '';
      if (!href || /^javascript:/i.test(href)) throw new Error('no link');
      var text = cleanText((last && last.linkText) || '') || href;
      return '[' + escapeLinkText(text) + '](' + href + ')';
    }
    if (menuItemId === 'mm-copy-image') {
      var src = (last && last.imgSrc) || info.srcUrl || '';
      if (!src) throw new Error('no image');
      var alt = cleanText((last && last.imgAlt) || '');
      return '![' + alt + '](' + src + ')';
    }
    if (menuItemId === 'mm-copy-selection') {
      var html = last && last.selectionHTML;
      var md = html ? convertHTML(html) : '';
      if (!md && info.selectionText) md = cleanText(info.selectionText);
      if (!md) throw new Error('empty selection');
      return md;
    }
    throw new Error('unknown menu: ' + menuItemId);
  }

  window.MarkdownMinimal = {
    convertHTML: convertHTML,
    build: build,
    cleanText: cleanText,
  };
})();
