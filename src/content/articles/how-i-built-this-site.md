---
title: "How I built this site"
description: "From a broken Jekyll build to a minimal Astro site — the stack, the design decisions, and why boring is best."
date: 2026-07-19
tags: [astro, tailwind, meta]
draft: true
---

<!-- TODO: Gui — write this article. Outline below to get you started. -->

## The problem with the old site

The old site ran on Jekyll with the default Minima theme. The build was broken: the homepage
was serving raw Liquid template syntax instead of rendered HTML. You could literally see
`{% for post in paginator.posts %}` on the live page.

The site was never finished. Rather than fixing it, I decided to rebuild from scratch with
a stack I'd actually enjoy maintaining.

## Why Astro

...

## The design

The primary reference is [morello.dev](https://morello.dev) — text-first, monospace, terminal-inspired.
No hero images, no sliders, no dark-mode toggles.

**Typography:** JetBrains Mono for all UI and headings. Source Serif 4 for article body text —
a serif is easier to read at length without losing the developer-tool feel.

**Color palette:** near-black background (`#111`), off-white text (`#d4d4d4`), orange accent
(`#f97316`) that sits close to Swift's own brand color.

## The stack

- **Astro v5** — static site generator, zero JS by default, Markdown as first-class content
- **Tailwind CSS v4** — utility-first, configured via CSS rather than a JS config file
- **Self-hosted fonts** via `@fontsource-variable` — no Google Fonts requests
- **Cloudflare Pages** — free static hosting, fast global CDN, easy domain setup

## What I learned

...
