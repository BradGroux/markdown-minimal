# markdown-minimal

Right-click anything on the web → clean Markdown on your clipboard. No popup, no options page, no accounts, no servers, no noise.

## What it does

Four context-menu items, nothing else:

| Right-click on | You get |
|---|---|
| A link | `[link text](https://…)` |
| An image | `![alt text](https://…)` |
| Selected text | The selection converted to Markdown — headings, bold/italic, links, lists (nested included), code blocks with language, blockquotes, tables, images |
| The page itself | `[page title](https://…)` |

A tiny violet `✓` flashes on the toolbar icon when the copy lands, `!` if something went wrong.

## Install

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this folder.

Works in Chrome, Edge, Brave, and any Chromium browser. (Firefox: the code is MV3-clean, but packaging for AMO is left as an exercise.)

## Privacy

There is none of your data to protect because none of it leaves the machine:

- No network requests. Ever. (The only URLs the extension touches are the ones it pastes into your Markdown.)
- No analytics, no storage, no accounts.
- Permissions are the minimum for the job: `contextMenus`, `clipboardWrite`, `activeTab`, plus host access so the menu works on pages.

## How it works

- `manifest.json` — MV3, four context menus, no popup.
- `background.js` — service worker: registers menus, asks the page for Markdown, writes it to the clipboard, flashes the badge.
- `context.js` — content script: records what was right-clicked (link, image, selection HTML).
- `md.js` — the tiny HTML→Markdown converter (headings, lists, code fences, tables, blockquotes, inline formatting). `javascript:` URLs are refused.

## Develop

```sh
npm test    # 13 background tests (stubbed chrome APIs) + 24 browser tests (real headless Chromium)
npm run icons  # re-rasterize icons/icon.svg → PNGs
```

Tests run against real headless Chromium with the actual extension code — including the real `contextmenu` → `chrome.runtime.onMessage` path the background worker uses.

## License

MIT.
