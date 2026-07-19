---
title: "How I built this site"
description: "From a broken Jekyll build to a minimal Astro site — the stack, the design decisions, and why boring is best."
date: 2026-07-20
tags: [astro, tailwind, meta]
draft: false
---

## The problem with the old site

The old site ran on Jekyll with the default Minima theme. The build was broken: the homepage
was serving raw Liquid template syntax instead of rendered HTML. You could literally see
`{% for post in paginator.posts %}` on the live page.

The site was never finished. Rather than fixing it, I decided to rebuild from scratch with
a stack I'd actually enjoy maintaining.

## Why Astro

Astro is the right tool for a personal site. It generates fully static HTML by default — zero JavaScript shipped to the browser unless you explicitly opt in. That means fast loads, no hydration overhead, and nothing to maintain at runtime.

The content layer in Astro v5 is particularly good. You define a collection, point it at a folder of Markdown files, and get type-safe frontmatter validation with Zod. Writing a new article is just adding a `.md` file. No CMS, no database, no API calls.

The alternative I considered was Next.js, which I use at work. But it would be using a sledgehammer for a nail — you don't need RSC and a Node server to serve a blog. Astro's output is a folder of HTML files, which deploys anywhere.

## The design

The primary reference is [morello.dev](https://morello.dev) — text-first, monospace, terminal-inspired. No hero images, no sliders, no dark-mode toggles. The page should load fast and get out of the way of the writing.

**Typography:** JetBrains Mono for all UI and headings. Source Serif 4 for article body text — a serif is easier to read at length without losing the developer-tool aesthetic. Both are self-hosted via `@fontsource-variable`, so there are no external requests to Google Fonts.

**Color palette:** near-black background (`#111`), off-white text (`#d4d4d4`), orange accent (`#f97316`). The orange sits close to Swift's own brand color, which felt appropriate.

**Layout:** single column, max 720px, 24px gutters. No sidebar, no tag clouds, no "related posts". The constraint forces clarity.

## The stack

- **Astro v5** — static site generator, zero JS by default, Markdown as first-class content
- **Tailwind CSS v4** — configured via CSS custom properties rather than a JS config file
- **Self-hosted fonts** via `@fontsource-variable` — no Google Fonts requests
- **Cloudflare Workers** — free hosting on the global edge network, custom domain included

## What I learned

**Tailwind v4 is a CSS-first rewrite.** There is no `tailwind.config.js`. Design tokens live in your CSS as custom properties, and the framework reads them. It felt unfamiliar for about ten minutes and then made complete sense.

**DNS changes take time, even when everything is correct.** Moving from Hostinger nameservers to Cloudflare meant the old A records were cached globally. The new site was serving correctly at the Cloudflare edge — I just had to wait for resolvers to catch up.

**Boring infrastructure is good infrastructure.** The deploy pipeline is twelve lines of GitHub Actions YAML: install, build, `wrangler deploy`. No containers, no preview environments, no staging. For a personal site, that's exactly right.
