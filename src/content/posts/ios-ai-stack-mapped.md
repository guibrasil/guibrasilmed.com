---
title: "The iOS AI stack, mapped"
description: "Foundation Models, Core ML, App Intents, MCP, and external LLMs. Five technologies, one app, no clear map. Here's how they fit together and when to use each."
pubDatetime: 2026-12-06
tags: [swift, ios, ai, architecture, foundation-models]
ogImage: /images/ios-ai-stack-cover.png
draft: true
---

There are five distinct AI layers an iOS developer needs to understand in 2026. Most tutorials cover one of them in isolation. Few explain how they relate to each other, when to use each, or what happens when you need more than one in the same app.

Here's the map.

---

## Layer 1: Apple Foundation Models

**What it is:** Apple's on-device language model, exposed through the Foundation Models framework in iOS 26. Approximately 3B parameters, running entirely on the Neural Engine.

**What it's for:** Text generation, classification, extraction, summarization, and simple reasoning over short text. Privacy-sensitive tasks. Features that need to work offline. High-frequency inference where per-token cloud cost would be significant.

**What it's not for:** Complex multi-step reasoning, large context windows, tasks requiring world knowledge beyond training, vision on older hardware.

**When to use it:** Default choice for text AI features in a new iOS 26+ app. If the task fits the model's capability range, use this first. No API key, no cost, no data leaving the device.

```swift
let session = LanguageModelSession(
    instructions: "Classify this note into one of these categories: Work, Health, Personal, Finance."
)
let category = try await session.respond(to: note.body).content
```

---

## Layer 2: Core ML

**What it is:** Apple's framework for running machine learning models on-device. Predates Foundation Models by several years. Handles custom models: image classification, object detection, natural language processing, tabular data, audio analysis.

**What it's for:** Task-specific models you've trained or converted for your use case. Image recognition, pose detection, style transfer, custom classifiers, recommendation systems. Anything where a general-purpose language model is the wrong tool and you need a model specialized to your data.

**What it's not for:** Open-ended text generation or instruction following. Core ML models are trained for specific tasks; they don't generalize.

**When to use it:** When Foundation Models isn't specific enough. If you're building a plant identification feature, a musical instrument recognizer, or a custom handwriting reader, you'll train or fine-tune a model and deploy it via Core ML. Create ML is the companion tool for training without leaving the Apple ecosystem.

```swift
let model = try PlantClassifier(configuration: MLModelConfiguration())
let input = PlantClassifierInput(image: cvPixelBuffer)
let output = try model.prediction(input: input)
print(output.classLabel)  // "Monstera deliciosa"
```

---

## Layer 3: App Intents

**What it is:** Apple's protocol for exposing app functionality to the system AI layer. Defines actions your app can perform and entities your app manages, in a way that Apple Intelligence and Siri can discover and compose.

**What it's for:** Making your app's functionality available to agentic AI workflows. Enabling cross-app task composition. Giving Apple Intelligence a vocabulary for interacting with your app's data and actions.

**What it's not for:** Inference or model execution. App Intents don't run AI; they expose your app to AI that runs at the system level.

**When to use it:** Any user-facing app targeting iOS 16+ should have App Intents. With iOS 26, this moved from "nice to have for Shortcuts users" to "required if you want Apple Intelligence to be able to reach into your app." Prioritize: define your entities first, then your core read/write actions.

```swift
struct GetRecentAlbumsIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Recently Played Albums"

    func perform() async throws -> some IntentResult & ReturnsValue<[AlbumEntity]> {
        let albums = try await ListeningRepository.shared.recentAlbums(limit: 10)
        return .result(value: albums.map(AlbumEntity.init))
    }
}
```

---

## Layer 4: MCP (Model Context Protocol)

**What it is:** An open protocol for giving AI models access to tools, resources, and data sources. Developed by Anthropic, now widely adopted across the AI tooling ecosystem.

**What it's for:** Connecting AI development tools (Claude Code, Cursor, Codex) to external systems. During development: giving your coding agent access to your simulator logs, Xcode diagnostics, App Store Connect data, or any other resource your workflow depends on.

**What it's not for:** End-user features. MCP is a development-time protocol. It's how you wire your AI coding tools to your project environment, not how you build AI features for your app's users.

**When to use it:** When your coding agent needs access to something it can't read from the filesystem. Your CI logs. Your crash reports. Your design system tokens. If you find yourself copying and pasting data into a prompt regularly, that data should probably be an MCP server.

A minimal MCP server for surfacing your Xcode build logs to Claude Code:

```typescript
// mcp-server/src/index.ts
server.tool("get-build-errors", async () => {
    const log = readFileSync("./build.log", "utf-8");
    const errors = log.split("\n").filter(l => l.includes("error:"));
    return { content: [{ type: "text", text: errors.join("\n") }] };
});
```

---

## Layer 5: External LLMs via API

**What it is:** Cloud language models accessed via API. Claude, GPT-4, Gemini, and others. Full frontier-model capability, available on any device, requiring a network connection and an API key.

**What it's for:** Tasks that exceed what Foundation Models can handle: complex reasoning, large context windows, vision on older hardware, tasks requiring current world knowledge, multi-turn conversations with nuanced context management.

**What it's not for:** Privacy-sensitive data, offline features, high-frequency inference where cost would add up quickly.

**When to use it:** When Foundation Models isn't capable enough. Use this as the fallback, not the default. The on-device model is free and private; reach for the API when you have a specific reason.

```swift
func analyzeAlbumReview(_ text: String) async throws -> ReviewAnalysis {
    let response = try await anthropicClient.messages.create(
        model: "claude-sonnet-4-6",
        maxTokens: 500,
        messages: [
            .user("Analyze this vinyl album review and extract: overall sentiment, mentioned attributes (sound quality, pressing, packaging), and a rating 1-10. Text: \(text)")
        ]
    )
    return try JSONDecoder().decode(ReviewAnalysis.self, from: response.content)
}
```

---

## How they interact

The five layers don't compete. They complement.

**Development time:** MCP connects your coding agent to your project environment. Foundation Models, Core ML, and App Intents are what you're building.

**AI features in your app:**
- On-device text intelligence: Foundation Models
- On-device custom model inference: Core ML
- System-level AI integration and cross-app workflows: App Intents
- Cloud-level capability when on-device isn't enough: external LLMs

**The common architecture pattern:**

```
User request
    ↓
App Intents (system entry point for Apple Intelligence)
    ↓
App logic layer
    ├── Foundation Models (on-device text tasks)
    ├── Core ML (specialized on-device models)
    └── External LLM API (complex reasoning, fallback)
```

---

## Decision framework

| Task | Layer |
|------|-------|
| Classify or summarize user text, on-device | Foundation Models |
| Recognize images, detect objects, custom ML | Core ML |
| Expose app to Apple Intelligence or Siri | App Intents |
| Wire coding agent to project tools/data | MCP |
| Complex reasoning, large context, cloud required | External LLM |

---

## A concrete example

A voice-driven task manager that integrates with Apple Intelligence:

- **App Intents**: expose `CreateTaskIntent`, `GetTasksIntent`, `CompleteTaskIntent` with `TaskEntity`. Apple Intelligence can now create tasks from natural language across the OS.
- **Foundation Models**: when a user types a task description, classify it automatically (Work, Personal, Health) and suggest a due date based on the description. On-device, free, private.
- **External LLM**: an optional "smart breakdown" feature that takes a complex goal ("plan my product launch") and breaks it into a structured task list. This needs frontier-model reasoning; Foundation Models isn't capable enough.
- **Core ML**: if you add a camera feature to capture handwritten tasks, a Core ML handwriting model converts the image to text before passing it to the pipeline.
- **MCP**: during development, an MCP server surfaces your simulator console logs to Claude Code so it can debug Intent execution without you copying output by hand.

Each layer does one thing. None of them are interchangeable. The architecture is clean because the responsibilities are clear.

---

## The practical starting point

If you're building a new app and want to integrate AI features without getting lost:

1. Add Foundation Models for any text task where the user generates input you need to process.
2. Define your App Intents immediately. It's cheaper to do this at the start than to retrofit it later.
3. Add an external LLM integration when you hit something Foundation Models can't handle well.
4. Add Core ML if you have a specific vision or audio task that needs a custom model.
5. Add MCP servers when your development workflow has a recurring context gap.

In that order. Not all at once.
