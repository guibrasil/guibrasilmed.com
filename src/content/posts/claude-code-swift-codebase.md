---
title: "I gave Claude Code my production Swift codebase"
description: "Not a demo project. A real app that users open every day. Here's what an AI agent actually does with production Swift code, what it got wrong with confidence, and what I changed afterward."
pubDatetime: 2026-12-02
tags: [swift, ios, ai, claude-code]
ogImage: /images/claude-code-swift-cover.png
draft: true
---

There's a gap between how AI coding tools are demonstrated and how they behave on real codebases.

The demos are always clean. A new feature, greenfield, well-specified, isolated. The model writes something elegant, it compiles, everyone applauds. The real world is a 40,000-line codebase with three years of decisions baked in, some of them good, some of them not, all of them interconnected in ways that aren't obvious from reading the files.

I wanted to know how Claude Code behaved in that environment. So I gave it mine.

---

## The setup

The app is a vinyl collection tracker. SwiftUI front end, SwiftData for persistence, a Discogs API integration in the back end. Around 40,000 lines of Swift, plus some Laravel for the API layer. It has real users. I care about not breaking it.

I ran a series of tasks over three weeks, ranging from "add a new feature" to "refactor this module" to "write tests for this service." I didn't cherry-pick the easy ones. I included tasks I thought might be hard for the model and tasks I thought would be straightforward.

I kept notes on what worked, what failed, and how the failures manifested.

---

## What it got right

**Test generation was genuinely good.** I pointed Claude Code at my `DiscogsService` class and asked it to write unit tests with a mock HTTP client. The tests it produced were correct, comprehensive, and followed the patterns in my existing test files. It found edge cases I hadn't covered. This alone saves me a material amount of time.

**Boilerplate was fast and accurate.** Adding a new screen that followed the existing pattern: view, view model, data flow, navigation wiring. It read the existing pattern correctly and replicated it cleanly. The output was indistinguishable from something I would have written.

**Documentation was surprisingly useful.** I asked it to document the public API of three service classes. The documentation it generated was accurate, specific, and better than the placeholder comments I'd left. It inferred the intent from the implementation, which is not trivial.

**Simple refactors worked well.** "Rename this throughout the codebase." "Extract this repeated logic into a shared utility." "Move these files into a new module." Fast, correct, no surprises.

---

## What it got wrong

**Swift 6 concurrency was consistently the failure zone.** This is the most important thing I found. The model knows the Swift concurrency APIs. It does not reliably understand actor isolation in the context of a real SwiftUI app.

Specifically: it generated code that accessed `@MainActor`-isolated state from a non-isolated context, without any warning from the type checker in the initial build. The app compiled. At runtime, in a specific timing scenario, it produced a UI update from a background thread. This is exactly the kind of bug that gets shipped.

The errors weren't random. They followed a pattern: the model would generate correct-looking async code, properly structured, using the right keywords, but with the isolation reasoning subtly wrong. It was confident. It was wrong.

**Hallucinated APIs.** On two occasions it used SwiftData APIs that don't exist. The names were plausible: they followed SwiftData's naming conventions and sounded like things that should exist. They didn't. One compiled because it happened to match a protocol method signature on a different type. That one was harder to catch.

**Missing intent without explicit context.** I asked it to "improve the search experience" with minimal additional context. It made changes that were technically reasonable but missed the actual problem: search was slow on large collections because of a filtering approach that didn't scale. The model optimized the wrong thing. When I gave it the specific problem, it solved it correctly. The fault was mine for underspecifying, but it illustrated something important: AI is good at solving the problem you describe, not the problem you have.

**Dependency on what it can read.** There's context in my codebase that isn't in any file. Business decisions that shaped the data model. API constraints from Discogs that informed certain patterns. A deliberate architectural choice to keep the UI layer thin for a reason that made sense at the time. The model had no access to any of that. When a task touched these areas, it made decisions that were locally reasonable and architecturally wrong.

---

## The pattern in the failures

Looking at what went wrong, the failures cluster around two things:

**Confidence without verification.** The model doesn't know what it doesn't know. When it's uncertain, it generates something plausible. It doesn't say "I'm not sure if this API exists." It writes the code and compiles it. If the compiler accepts it, the model considers the task done. Runtime behavior is not part of its feedback loop.

**Reasoning about dynamic behavior.** Concurrency bugs, timing issues, state mutations that happen in the wrong order: these require reasoning about what the code does over time, not just what it says. The model is better at static structure than dynamic behavior.

---

## What I changed afterward

**Everything concurrency-related gets reviewed manually.** This is now a rule. I don't trust AI-generated code that touches async/await, actors, or @MainActor without reading it myself. The pattern of confidence-without-correctness in this area is too consistent.

**I write better CLAUDE.md entries.** The tasks where context mattered most were the tasks where my context file was weakest. I've since added notes about specific architectural decisions, known constraints, and the reasoning behind patterns that might look arbitrary.

**I added a hallucination check to my review.** When reviewing AI output, I now specifically look up any API I don't recognize. Takes thirty seconds. Has already caught two hallucinated method calls that the compiler accepted.

**I write tighter specs.** The "improve search" task failure was my fault. I've since committed to describing the specific problem, not the desired outcome, when giving Claude Code a task. "Users with collections over 500 items see search results take three-plus seconds because filterRecords is called on every keystroke" is a spec. "Improve search" is a wish.

---

## The honest assessment

Claude Code is genuinely useful on a real production codebase. The test generation alone justifies the workflow change. The boilerplate speed is real. The refactoring confidence, knowing you can rename something across 40,000 lines and have it done correctly in thirty seconds, changes how willing you are to make the right call instead of the easy one.

The failures are real too. They're not random. They're predictable, once you know where to look.

The engineers getting the most out of these tools aren't the ones who trust them most. They're the ones who know exactly where not to trust them.
