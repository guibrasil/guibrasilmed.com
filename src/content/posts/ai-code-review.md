---
title: "What 27% of your code being AI-written actually means for code review"
description: "AI-authored code reached 27% of production in 2026. The review skill is now the core engineering skill. Here's how AI output fails differently than human output, and how to catch it."
pubDatetime: 2026-12-05
tags: [swift, ios, ai, testing]
ogImage: /images/ai-code-review-cover.png
draft: true
---

27% of production code is AI-authored in 2026. Gartner projects 60% by the end of the year.

If you're reviewing code and not accounting for how AI output fails differently than human output, you're reviewing it wrong.

This isn't a critique of AI tools. The tools are good. The failure modes are real and consistent, and they're different enough from human failure modes that the review habits you've built over years don't fully catch them. The engineers who understand this will catch bugs that others miss.

---

## How human code fails vs how AI code fails

Human code fails in ways that reflect human nature: distraction, fatigue, misunderstanding requirements, copy-paste errors, taking shortcuts under deadline pressure. The bugs tend to cluster around complexity: the edge case in the deeply nested condition, the off-by-one in the loop, the missing null check in a code path that "never happens."

AI code fails differently.

**Confidence without verification.** The model generates what looks correct. It doesn't distinguish between things it knows with certainty and things it's inferred plausibly. A hallucinated method call looks identical to a real one until you compile. A subtly wrong concurrency pattern looks identical to a correct one until runtime.

**Plausible but nonexistent APIs.** The model has seen a lot of Swift. It knows naming conventions. When it needs an API that doesn't exist, it invents one that follows the right conventions and sounds like it should exist. This catches you when the compiler accepts it because it matches a protocol method on a different type, or when it's close enough to a real API that you mentally autocorrect while reading.

**Outdated patterns.** The model's training data has a cutoff. iOS development changes at WWDC. Code generated for iOS 15 patterns in a codebase targeting iOS 26 will compile in many cases and behave incorrectly in others. The model doesn't know what it doesn't know about iOS 26.

**Structural correctness, semantic incorrectness.** The hardest failure mode to catch. The code is well-structured, well-named, type-safe, and does something subtly different from what was intended. The function that filters correctly but mutates a parameter it shouldn't. The view model that updates the right state but in the wrong order.

---

## Swift-specific failure modes

**Concurrency: the most dangerous one.** Swift 6 made data race safety a compiler guarantee in many cases. AI-generated concurrency code exploits the gaps: actor isolation mismatches that the compiler accepts in certain contexts, nonisolated functions that access `@MainActor`-isolated state, structured concurrency that handles cancellation incorrectly.

What to look for: any `async` function that accesses UI state. Any `Task` that captures `self` without explicit isolation. Any `nonisolated` annotation. Any `await` inside a `@MainActor` context that calls a function without explicit isolation marking.

This is the class of error that gets shipped, lives in production for months, and manifests as a rare crash on a specific device under specific timing conditions.

```swift
// This compiles. The isolation is wrong.
class HomeViewModel: ObservableObject {
    @Published var items: [Item] = []

    func loadItems() {
        Task {
            let fetched = await itemService.fetch()
            items = fetched  // Accessing @MainActor-isolated property from non-isolated Task
        }
    }
}
```

The fix requires `@MainActor` on the assignment or on the entire function. The model generates the first version more often than the second.

**Memory management in closures.** AI models tend toward strong captures in closures. The `[weak self]` pattern is well-known and the model uses it, but it misses it in certain patterns: closures stored as properties, closures passed to long-lived services, closures in Combine pipelines.

**Force unwraps in generated code.** The model knows force unwraps are bad practice. It still generates them in locations where it's inferred the value will always be non-nil but can't prove it. These become crashes under production conditions the model didn't consider.

**Stale SwiftUI patterns.** `@ObservableObject` and `@StateObject` in codebases targeting iOS 17+ should have been replaced by `@Observable`. The model reaches for the old pattern frequently, especially in complex view hierarchies. The old pattern works; it's just not what you want.

---

## The review checklist for AI-generated Swift

Add this to your code review process for any code you know or suspect was AI-generated:

**Concurrency audit**
- Every `async` function: where does it run? Is that where it needs to run?
- Every `Task` creation: what's the isolation context?
- Every access to `@Published` or `@Observable` properties from async contexts: is it on the right actor?

**API existence check**
- Anything you don't immediately recognize: does it exist? Cmd+click it.
- Method signatures that look slightly unfamiliar: are the parameter labels exactly right?

**Pattern vintage**
- `@ObservableObject` in iOS 17+ target: should it be `@Observable`?
- `NSUserDefaults` direct access: should it be `@AppStorage`?
- Completion handlers: should they be `async throws`?

**Semantic correctness**
- Read the function name, then read the implementation. Do they match?
- Read the parameters, then check how they're used. Is the usage consistent with the name?
- Find the edge cases: empty collection, nil optional, network failure, cancellation. Does the code handle them?

**Test coverage of AI-generated logic**
- Does the generated test cover behavior or implementation?
- Tests that assert on method call counts rather than outcomes are fragile. The model tends to generate them.
- Are the test cases complete, or did the model generate happy-path only?

---

## Building a /code-review skill for your project

Matt Pocock's /code-review skill frames review as two passes: correctness bugs, then simplification opportunities. For Swift projects, extend this with a third pass: AI-specific failure modes.

In your CLAUDE.md or SKILLS.md:

```markdown
## /code-review

Review the diff for:

**Pass 1: Correctness**
- Logic errors, missing edge cases, wrong behavior
- Swift concurrency: actor isolation, Task context, MainActor boundaries
- Hallucinated or incorrect API usage
- Force unwraps without justification

**Pass 2: Simplification**
- Code that is more complex than it needs to be
- Duplicated logic that could be extracted
- Unnecessary abstraction layers

**Pass 3: Pattern vintage**
- Deprecated patterns for the project's iOS target
- Patterns inconsistent with the established codebase conventions

Report findings as a bulleted list. For each finding: location, what's wrong, and what the fix should be.
```

---

## The career angle

Code review has always been a senior skill. It requires understanding intent, not just syntax. It requires knowing what the code is supposed to do well enough to recognize when it doesn't.

That skill is now the most defensible skill in a world where 27% (and rising) of the code being reviewed was written by a model. The engineers who can catch what the model missed, who understand the failure modes, who have built the review habits that account for AI output: they're doing work that's genuinely difficult to automate.

You can't use an AI agent to reliably review AI-generated code for the same reasons you can't use the same reasoning system that produced an error to reliably detect the error. You need a human who understands the failure modes.

That's not going away.
