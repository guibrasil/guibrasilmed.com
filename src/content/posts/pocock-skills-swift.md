---
title: "The Matt Pocock workflow, translated for Swift"
description: "Pocock built the best AI coding methodology in the TypeScript world. The core idea — interview before code — works for iOS development too. Here's how to adapt it."
pubDatetime: 2026-12-03
tags: [swift, ios, ai, workflow]
ogImage: /images/pocock-skills-cover.png
draft: true
---

Matt Pocock is a TypeScript educator. His AI Hero platform teaches AI-assisted coding to engineers, and his /skills library for Claude Code has become one of the most referenced methodologies in the AI-coding space. The workflow he's built has nothing specifically to do with TypeScript. It has everything to do with how to work with a coding agent without producing garbage.

Most iOS developers don't follow his work. They should.

---

## The core idea

The mistake most engineers make with AI coding tools is treating them like a search engine with autocomplete. You have a vague idea. You prompt. You get code. The code is wrong in ways you didn't anticipate. You prompt again. You iterate. An hour later you have something that works, and you're not sure you understand it.

Pocock's insight is simpler: the reason the output is bad is that the input was bad. AI agents are exceptionally good at executing a clear spec. They're not good at clarifying ambiguous requirements before they start. So the workflow needs to front-load the clarification.

His /grill-me skill tells the agent to interview him, relentlessly, before writing a single line of code. The interview forces the engineer to articulate constraints they hadn't consciously considered. The spec that emerges from that interview is better than any spec the engineer would have written without the prompting. The code that comes from that spec is better than anything that would have come from a vague prompt.

---

## The full workflow

Pocock's recommended sequence: `/grill-me` → `/to-spec` → `/to-tickets` → `/implement` → `/code-review` → `/retro`

Each step feeds the next. The output of the interview becomes the spec. The spec becomes the tickets. The tickets drive implementation. The implementation gets reviewed. The review improves your CONTEXT.md for the next task.

Here's what each step means in an iOS context.

---

## /grill-me: the interview

The agent asks you questions until it has a precise understanding of what you want. For an iOS feature, the questions should cover:

- Target iOS version
- Which existing files and patterns are relevant
- What the feature needs to do and what it explicitly doesn't need to do
- What the success criteria are
- Any constraints: navigation structure, data model boundaries, what not to change

For Claude Code, you can implement this as a prompt in your CLAUDE.md or as a custom skill:

```markdown
# SKILLS.md

## /grill-me

Interview me about the task I'm about to describe. Ask questions until you have:
- A precise description of what needs to be built
- The iOS version target and any framework constraints
- Which existing files are relevant and which patterns to follow
- What done looks like (testable criteria)
- What explicitly NOT to change

Don't suggest solutions during the interview. Only ask questions. When you have enough information, summarize your understanding and ask me to confirm before proceeding.
```

The discipline is not rushing this step. Engineers with experience tend to feel like they already know what they want and want to skip to implementation. The interview finds the things you think you know but don't.

---

## /to-spec: the written spec

After the interview, generate a spec. Not code: a document. The spec should be short enough to fit in a single screen and precise enough that a developer (or an AI agent) could implement it without asking questions.

For iOS features, a good spec covers:

```markdown
## Feature: Recently viewed albums

### What it does
Displays the last 5 albums the user viewed, in reverse chronological order,
in a horizontally scrolling section on the home screen above the main feed.

### What it doesn't do
- Does not persist across app launches (session-only for now)
- Does not appear if the user has viewed fewer than 2 albums

### Files involved
- Views/Home/HomeView.swift (add the section)
- ViewModels/HomeViewModel.swift (add recentlyViewed: [Album] property)
- Services/RecentsTracker.swift (create new service)

### Patterns to follow
- Card style: same as FeaturedAlbumCard.swift
- Use @Observable for the view model property
- Track views in RecentsTracker via a didView(_ album: Album) method

### Done when
- Section appears on home screen after viewing 2+ albums
- Scrolls horizontally
- Tapping a card navigates to AlbumDetailView
- Unit tests cover RecentsTracker (add, dedup, limit to 5)
```

This takes ten minutes to write. It saves an hour of back-and-forth with the agent.

---

## /to-tickets: breaking it down

For anything non-trivial, break the spec into discrete implementation tickets before starting. Each ticket should be completable in a single agent session.

For the example above:
1. Create `RecentsTracker` service with add, deduplicate, and limit-to-5 logic, plus unit tests
2. Add `recentlyViewed` property to `HomeViewModel`, wired to `RecentsTracker`
3. Create `RecentAlbumsSection` view using `FeaturedAlbumCard` style
4. Integrate `RecentAlbumsSection` into `HomeView`, with the two-album minimum condition

One ticket. One session. One reviewable diff. This keeps context manageable and makes review easier.

---

## /implement: writing the code

Now you give the agent a ticket and let it run. The spec provides the what. The ticket provides the scope. The agent writes the code.

For iOS, your CLAUDE.md context matters here. The more it knows about your project's conventions, the less it has to infer. After implementing the spec through the interview process, you have a clear picture of which conventions are relevant. Add them.

---

## /code-review: reviewing the output

After implementation, review. For iOS specifically, the review checklist should include:

- Concurrency: any async/await or actor usage, check the isolation manually
- API existence: any API you don't immediately recognize, verify it exists
- Pattern consistency: does the implementation follow the patterns described in the spec?
- Tests: do the tests actually test behavior, or are they implementation mirrors?

Pocock's /code-review skill frames the review as a two-axis check: correctness bugs (things that are wrong) and simplification opportunities (things that are more complex than they need to be). Both matter. AI-generated code tends toward verbosity.

---

## /retro: improving your context

After each significant task, spend five minutes on the retro. What did the agent get wrong? What context would have prevented it? What constraint was violated that wasn't in your CLAUDE.md?

Add those to your CLAUDE.md. This is how the workflow compounds. The first task with an agent produces mediocre output. The twentieth task, after twenty retros, produces output that required significantly less correction.

Pocock's v1.3 skills renamed CONTEXT.md to GLOSSARY.md, adding a project-specific vocabulary that the agent uses consistently. For iOS, your glossary might include the names of your internal service layer conventions, the specific terminology your team uses for feature areas, or the names of patterns you've developed that don't have standard names.

---

## Why this matters more for iOS than TypeScript

TypeScript has a large training corpus. The models know it deeply. iOS development has a smaller corpus and changes significantly with every WWDC. The spec-first workflow compensates for this: when the agent has a precise spec and your project context, it doesn't need to guess at conventions. You've told it what they are.

The engineers I know who get the best results from AI tools on iOS projects are the ones who've built up the most detailed CLAUDE.md files. Not the ones using the most sophisticated prompts: the ones who've done the most retros.
