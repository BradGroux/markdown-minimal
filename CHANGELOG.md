# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] - 2026-09-19

### Added
- Toolbar popup in the minimal-family design language (dark `#16161d`, violet `#6d4fc2`, 300px): shows what each right-click menu copies, plus an About section — brought to you by Brad Groux ([Twitter](https://twitter.com/bradgroux)) and [Digital Meld](https://go.sstb.ai/extensions), with a link to learn to build tools like this in the [SSTB.ai community](https://go.sstb.ai/markdown-minimal).
- README rewritten in the minimal-family voice: badges, screenshots, features, permissions table, FAQ, About.
- `docs/PRIVACY.md`: the whole privacy story in one page — nothing is collected, nothing leaves the machine.

## [1.0.0] - 2026-09-19

### Added
- Initial release: four context-menu items — copy link, image, selection, and page as Markdown.
- Local HTML→Markdown converter: headings, bold/italic, links, nested lists, fenced code blocks with language detection, blockquotes, tables, images. `javascript:` URLs refused.
- Quiet confirmation: a violet ✓ badge flash on copy, `!` on failure.
- 37 tests: background worker (stubbed chrome APIs) + converter and message-path tests in real headless Chromium.
