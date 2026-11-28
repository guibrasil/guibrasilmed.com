---
title: "Apple Foundation Models: three lines of Swift, no API key, no cloud bill"
description: "iOS 26 ships a 3B-parameter model to every developer for free. Here's what it can actually do, what it can't, and how to integrate it in a real app without surprises."
pubDatetime: 2026-11-30
tags: [swift, ios, ai, foundation-models]
ogImage: /images/foundation-models-cover.png
draft: true
---

No API key. No network request. No cost per token. No privacy review for sending user data to a third party.

That's the Foundation Models pitch. With iOS 26, Apple ships a roughly 3-billion-parameter language model to every device with an A17 Pro chip or later, exposed to developers through a native Swift framework. The same model powering Apple Intelligence is now available in your app with three lines of code.

Most iOS developers have heard about this. Far fewer have actually integrated it. Here's what you need to know to use it in production.

---

## What Foundation Models actually is

Foundation Models is not a wrapper around ChatGPT. It's Apple's own on-device model, running entirely on the Neural Engine. No data leaves the device. The model is the same one Siri uses for Apple Intelligence tasks, pruned and optimized to run on iPhone hardware.

The key constraints:

- Requires iOS 26 and an A17 Pro, M1, or later chip. Older devices don't have the hardware. Plan your minimum deployment target accordingly.
- Context window is limited compared to cloud models. It's suited for focused, single-purpose tasks, not long document analysis.
- No fine-tuning. You prompt it; you don't train it.
- No vision in the initial release on older hardware, though the WWDC26 session showed vision capabilities landing on newer chips.

What it's genuinely good at: classification, extraction, summarization, reformatting, and simple reasoning over short text. What it's not suited for: complex multi-step reasoning over large amounts of data, tasks that require world knowledge beyond what the model was trained on, or anything requiring the sustained quality of a frontier model.

---

## The three lines

```swift
import FoundationModels

let session = LanguageModelSession()
let response = try await session.respond(to: "Summarize this in one sentence: \(userNote)")
print(response.content)
```

That's it. `LanguageModelSession` manages the model lifecycle. `respond(to:)` sends a prompt and returns a response. The whole thing is async and throws, which fits naturally into Swift's concurrency model.

For anything beyond a one-off call, you'll want to hold onto the session and configure it:

```swift
let session = LanguageModelSession(
    instructions: "You are a tag extractor. Given a note, return a comma-separated list of relevant tags. Return only the tags, nothing else."
)

let tags = try await session.respond(to: userNote.body)
```

The `instructions` parameter is your system prompt. Keep it focused and specific. The model performs significantly better when the instructions constrain the task tightly.

---

## Structured output with Generable

The raw string response is fine for display. For anything you need to parse programmatically, use the `Generable` protocol.

```swift
@Generable
struct NoteClassification {
    let category: String
    let sentiment: Sentiment
    let tags: [String]

    @Generable
    enum Sentiment: String {
        case positive, negative, neutral
    }
}

let session = LanguageModelSession(
    instructions: "Classify the given note."
)

let result = try await session.respond(
    to: userNote.body,
    generating: NoteClassification.self
)

print(result.category)   // "Work"
print(result.sentiment)  // .positive
print(result.tags)       // ["meeting", "project", "deadline"]
```

The `@Generable` macro generates the schema the model uses to constrain its output. The model will produce valid JSON that maps to your type. You get a strongly-typed Swift value back, no manual parsing required.

This is the pattern to use for anything that feeds back into your app logic.

---

## Streaming responses

For longer responses, stream:

```swift
let stream = session.streamResponse(to: prompt)

for try await partial in stream {
    await MainActor.run {
        displayText = partial.content
    }
}
```

The streaming API updates `partial.content` as tokens arrive. This is the right pattern for anything you're displaying to the user: it makes the app feel responsive even if the full response takes two or three seconds.

---

## Practical use cases that actually work

**Smart defaults.** When a user creates a new item, pre-fill the category or tags based on the title. Fast, free, private, and the user can always override.

```swift
func suggestCategory(for title: String) async -> String? {
    let session = LanguageModelSession(
        instructions: "Return the most fitting category for a task with the given title. Choose from: Work, Personal, Health, Finance, Learning. Return only the category name."
    )
    return try? await session.respond(to: title).content
}
```

**Local summarization.** Summarize notes, emails, or reading list items without sending them to a server. For apps in regulated industries (health, finance), this is significant: AI features that don't require a data processing agreement.

**Input normalization.** Users type inconsistently. The model can normalize free-text input into a structured format before you store it.

**Contextual suggestions.** Suggest next actions based on what a user just did. Because it's on-device and fast, you can run this speculatively without it feeling like a loading state.

---

## When to reach for an external API instead

Foundation Models is not a replacement for frontier models. Use it for:

- Short, focused tasks with well-defined outputs
- Privacy-sensitive content that shouldn't leave the device
- Features that need to work offline
- High-frequency calls where per-token cost would add up

Reach for Claude, GPT-4, or Gemini when you need:

- Complex reasoning or multi-step problem solving
- Large context windows (long documents, long conversation history)
- Tasks that require broad world knowledge or recency
- Vision on older hardware

The practical pattern for most apps: use Foundation Models for the common case, fall back to a cloud model for complexity that exceeds what the on-device model handles reliably.

---

## Error handling

The model can fail to generate a valid response, especially with constrained output types. Always handle the throws:

```swift
do {
    let result = try await session.respond(to: input, generating: NoteClassification.self)
    apply(result)
} catch LanguageModelError.unsupportedHardware {
    // Device doesn't meet requirements. Degrade gracefully.
    showFallback()
} catch {
    // Model failed to generate valid output. Log and continue.
    logger.error("Foundation Models failed: \(error)")
}
```

The `unsupportedHardware` case is the one you can't retry. Everything else is worth retrying once with a simpler prompt before falling back.

---

## The privacy angle

This is undersold. For many app categories, the ability to offer AI features without sending user data to a third-party server changes the product conversation entirely.

Health apps, journaling apps, finance apps, anything that handles sensitive personal data: Foundation Models lets you ship AI features that your legal team can approve without a lengthy review process, because nothing leaves the device.

That's not a small thing.
