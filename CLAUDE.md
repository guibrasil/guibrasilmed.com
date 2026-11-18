# guibrasilmed.com

## Stack

- **Theme**: AstroPaper v7.2.0 — one-time copy, no upstream remote. Do not `git remote add` astropaper.
- **Framework**: Astro 7 (static output)
- **Styling**: Tailwind v4 + `@tailwindcss/typography`
- **Package manager**: npm (use `npm install`, not pnpm)
- **Node**: ≥ 22.23.4

## Deploy

`main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm ci && npm run build` → `npx wrangler deploy` → Cloudflare Workers serving `./dist`.

**Branches do NOT deploy.** Only merges to `main` trigger a deploy.

## Config & customisation

| What | File |
|------|------|
| Site title, URL, author, socials, shareLinks | `astro-paper.config.ts` |
| Fonts (JetBrains Mono + Source Serif 4) | `astro.config.ts` → `fonts[]` |
| Colours (dark/light CSS vars) | `src/styles/theme.css` |
| i18n strings (nav labels, page titles) | `src/i18n/lang/en.ts` |
| Article body serif font | `src/styles/typography.css` (`.app-prose p, li, blockquote`) |
| OG image font references | `src/pages/og.png.ts`, `src/pages/articles/[...slug]/index.png.ts` |

## How to add an article

1. Create `src/content/posts/<filename>.md` (or `.mdx`).
2. Required frontmatter:

```md
---
title: "Your article title"
description: "One-sentence description for SEO and card previews."
pubDatetime: 2026-01-15
tags: [swift, ios]
draft: false
---
```

- Optional: `featured: true` to surface on the home page hero.
- URL will be `/articles/<filename>` (the slug is the filename without extension).
- `draft: true` skips the post from production builds.

## JavaScript rules

Pagefind, theme toggle, and the theme's small nav/TOC scripts are the only JS on the site. Do not add analytics, comments, or any other client-side JS unless explicitly requested.

## Nav & pages

- **Nav order**: Articles → Apps → Tags → Recruiters → search icon → theme toggle
- `/speaking` exists but is **not** in the nav — it's a placeholder for future talks
- There is no `/about` page — it was removed intentionally

## Open TODOs

- [ ] Add `/downloads/gui-medeiros-cv.pdf` and restore the CV download link in `src/pages/recruiters.astro` (look for the `<!-- TODO: add /downloads/... -->` comment)
- [ ] Add `public/favicon.svg` — the original was kept from the old site but the theme ships its own; replace with a custom one when ready
