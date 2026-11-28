---
title: "The iOS developer's AI workflow in 2026"
description: "Claude Code, Cursor, and Codex aren't interchangeable. Here's the actual setup that works for Swift development, and how to wire these tools together without constantly thinking about which tool to reach for."
pubDatetime: 2026-11-29
tags: [swift, ios, ai, workflow]
ogImage: /images/ios-ai-workflow-cover.png
draft: true
---

Everyone has an opinion on AI coding tools. Few have a workflow.

The difference matters. A tool you pick up occasionally when stuck is not the same as a tool wired into how you think about every task. By now, the best iOS engineers I know aren't using AI as a smarter autocomplete. They've rebuilt their workflow around it. The output is different. The speed is different. The kind of work they can take on is different.

Here's the setup that actually works for Swift development in 2026.

---

## The three tools and what they're actually for

**Claude Code** is an agentic coding assistant that runs in your terminal. It can read your entire codebase, write files, run tests, and work through multi-step tasks without you babysitting it. The key distinction: Claude Code works best on tasks you can describe clearly in advance and then step back from. You give it a task, it runs, you review the diff.

**Cursor** is an editor. Its strength is the tight feedback loop: AI that knows exactly what file you're in, what's selected, what the compiler is saying. It's the right tool when you're actively writing, when you have a half-formed idea and need to iterate quickly, when the context is what's on screen right now.

**Codex** (OpenAI's coding agent) handles background tasks: PR descriptions, review summaries, test generation for existing code. It's the tool that runs while you're doing something else.

The mistake is treating them as interchangeable. They're not. Using Claude Code when you should be in Cursor means constantly re-explaining context. Using Cursor when you should use Claude Code means manually applying the same edit across twenty files.

---

## The workflow

### Step 1: spec before code

The single most important habit. Before any non-trivial task, write a spec. Not a novel: a paragraph or two that answers these questions:

- What needs to exist that doesn't exist now?
- What are the constraints? (Target iOS version, existing patterns to follow, what NOT to change)
- What does done look like?

Matt Pocock's /grill-me skill does this systematically for TypeScript projects. The same principle applies here. His agent interviews him before writing a line of code. The interview forces precision. Precision produces better output.

For iOS, your spec might look like this:

```
Add a "Recently viewed" section to the home screen.

- Show the last 5 items the user viewed, in reverse chronological order.
- Use the existing RecentsRepository — don't create a new one.
- Follow the same card pattern as the Featured section (FeaturedCard.swift).
- iOS 17+ only. Use @Observable, not @ObservableObject.
- Don't touch the tab bar or navigation stack.
```

That's enough. Claude Code can work from that.

### Step 2: implement with Claude Code

For anything that touches more than two or three files, Claude Code. Give it your spec. Let it run. Don't interrupt.

The temptation is to watch it work and jump in when you disagree with a decision. Resist this. Let it finish, then review the diff as a whole. You'll catch more in one review pass than in a dozen interruptions, and you won't derail its reasoning mid-task.

What to put in your CLAUDE.md to make this work:

```markdown
## Conventions

- SwiftUI views in Views/, grouped by feature
- Use @Observable (iOS 17+), not @ObservableObject
- async/await throughout. No completion handlers.
- No force unwraps. Use guard let or if let.
- Group: views, then view models, then models, then services

## What to avoid

- Don't add logging beyond what already exists
- Don't change the navigation structure
- Don't introduce new dependencies without asking
```

The more context you give it upfront, the less it has to guess, and the less you have to fix.

### Step 3: review in Cursor

Once Claude Code is done, open the diff in Cursor. This is where the tight feedback loop matters. You're reviewing line by line. If something is wrong, you fix it inline. If a pattern is off, you select it and ask Cursor to adjust it.

This is also where you check the things AI consistently gets wrong in Swift (more on that below).

### Step 4: run and verify

Build. Run the simulator. Test the golden path and at least one failure case. AI-generated code that passes the type checker and compiles cleanly can still have wrong behavior. The build passing is the starting point, not the end.

---

## Swift-specific things to always check manually

**Swift 6 concurrency.** This is the biggest source of AI errors in Swift codebases right now. The model knows the APIs. It does not reliably understand actor isolation, Sendable requirements, and the interaction between @MainActor and async/await in SwiftUI. Generated concurrency code compiles surprisingly often and misbehaves at runtime in subtle ways. Always read it.

**SwiftUI view lifecycle.** AI handles stateless views well. It struggles with the interaction between @State, @Environment, and task modifiers. Generated code often creates state that outlives its view or tasks that fire at the wrong time.

**Declarative patterns.** The more your code looks like standard SwiftUI declarative patterns, the better the AI output. The further you are from standard patterns (custom layout, complex animations, interaction with UIKit), the more you'll need to intervene.

**APIsthat changed.** Models have a knowledge cutoff. iOS 26 APIs introduced after training will either be hallucinated or the model will reach for the older equivalent. Cross-reference anything that uses a framework you've recently updated.

---

## The mental shift

The engineers getting the most out of this workflow aren't thinking "how do I get the AI to write this code." They're thinking "how do I describe this task clearly enough that the AI produces something reviewable."

That's a different skill. It's closer to technical writing than to coding. The engineers who were already good at breaking down problems, writing clear requirements, and reviewing code critically are adapting fast. The engineers who relied on the act of writing code to figure out what they were building are having a harder time.

The workflow doesn't eliminate judgment. It moves judgment to a different part of the process.

---

## Setup checklist

- Claude Code installed and authenticated (`npm install -g @anthropic-ai/claude-code`)
- CLAUDE.md in your project root with conventions and constraints
- Cursor set up with your project open
- A habit of writing a spec before any task that spans more than one file

That's it. The tools are table stakes. The spec habit is what changes the output.
