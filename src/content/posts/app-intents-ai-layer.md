---
title: "App Intents are the AI layer nobody is talking about"
description: "App Intents started as a Shortcuts feature. In iOS 26, they became the bridge between your app and Apple's agentic AI. Most tutorials haven't caught up. Here's what actually changed."
pubDatetime: 2026-12-04
tags: [swift, ios, ai, app-intents, swiftui]
ogImage: /images/app-intents-ai-cover.png
draft: true
---

Most App Intents tutorials start the same way: "App Intents let you expose your app's functionality to Siri and Shortcuts."

That framing was accurate in 2022. In 2026, it's missing the point.

App Intents are now the bridge between your app and Apple's agentic AI layer. When Apple Intelligence needs to perform a task in your app, it looks for Intents. When Siri composes multiple steps across apps to accomplish something, Intents are the protocol. When a user asks "get me my recent vinyl purchases from TurnLog and add them to this list," the execution path runs through App Intents.

Engineers who built Intents for Shortcuts have a head start. Engineers who skipped them because they "just needed Siri support" need to revisit the decision.

---

## A brief history of why this matters now

App Intents launched with iOS 16, replacing SiriKit. The original pitch was straightforward: expose actions your app can perform, describe them in a way Siri can understand, and users can invoke them with voice commands or in Shortcuts automations.

Adoption was uneven. Shortcuts has an enthusiastic but niche user base. Many teams built minimal Intents coverage because the ROI was unclear. The integration work was real. The user benefit was small for most apps.

What changed is the intelligence layer above it.

Apple Intelligence uses Intents as its action vocabulary. When the system needs to perform a task in a third-party app, it looks for Intents that match what it's trying to do. An app without well-defined Intents is an app Apple Intelligence can't reach into. That was fine when "Apple Intelligence" meant Siri suggestions. It's a different calculation when it means an agentic AI that proactively orchestrates tasks across apps on the user's behalf.

---

## The structure of an Intent

An App Intent is a struct that conforms to the `AppIntent` protocol. It describes a single action your app can perform, the parameters it needs, and how to execute it.

```swift
import AppIntents

struct LogListeningSessionIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Listening Session"
    static var description = IntentDescription("Records an album listening session in TurnLog.")

    @Parameter(title: "Album")
    var album: AlbumEntity

    @Parameter(title: "Notes", default: nil)
    var notes: String?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let session = ListeningSession(album: album.id, notes: notes, date: .now)
        try await ListeningSessionRepository.shared.save(session)

        return .result(dialog: "Logged \(album.title). \(session.formattedDuration) session recorded.")
    }
}
```

The key pieces:

- `title` and `description`: what Apple Intelligence sees when it's deciding whether this Intent can fulfill a request
- `@Parameter`: the inputs the Intent needs. These can be provided by the user, inferred from context, or supplied by the AI.
- `perform()`: the execution. This is where your app's logic runs.

---

## Entities: the vocabulary of your app's data

Intents work with Entities. An Entity represents a persistent thing in your app that the system (and AI) can reference.

```swift
struct AlbumEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Album"
    static var defaultQuery = AlbumEntityQuery()

    var id: UUID
    var title: String
    var artist: String
    var year: Int?

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "\(artist)"
        )
    }
}
```

The `defaultQuery` is what makes Entities powerful. It tells the system how to find instances of this Entity, either by ID or by search:

```swift
struct AlbumEntityQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [AlbumEntity] {
        try await AlbumRepository.shared.albums(for: identifiers).map(AlbumEntity.init)
    }

    func suggestedEntities() async throws -> [AlbumEntity] {
        try await AlbumRepository.shared.recentAlbums(limit: 10).map(AlbumEntity.init)
    }
}
```

When a user asks Siri "log a listening session for Kind of Blue," the system uses your `AlbumEntityQuery` to find the matching album, then supplies it as the `album` parameter to `LogListeningSessionIntent`. The user doesn't have to specify an ID. The system looks it up.

---

## The agentic pattern

The shift in iOS 26 is that Apple Intelligence can now compose Intents. A single user request can trigger a sequence of Intent executions across your app and others.

"Add the last five albums I logged to my Vinyl Friday playlist on Music" is a multi-step task:
1. Query TurnLog for recent listening sessions (via a `GetRecentSessionsIntent`)
2. Extract the album identifiers
3. Find those albums in Music
4. Add them to the named playlist

Each step is an Intent. The AI orchestrates the sequence. Your app doesn't need to know about Music, and Music doesn't need to know about TurnLog. The Intent protocol is the shared language.

For this to work, your Intents need to be:

**Composable.** They should return values that other Intents can use as inputs. `GetRecentSessionsIntent` should return `[AlbumEntity]`, not a formatted string.

**Descriptive.** The `title` and `description` are not just for user-facing display. Apple Intelligence uses them to decide whether an Intent matches a request. Write them precisely.

**Parameterized correctly.** Parameters marked as required will block execution if they can't be inferred. Parameters marked as optional will be skipped gracefully. Design this deliberately.

---

## Practical integration checklist

If your app is in production and you haven't thought about App Intents beyond the basics, here's the priority order:

1. **Define your core Entities first.** What are the primary objects in your app that a user might refer to by name? Those become Entities. Without Entities, your Intents can't be composed.

2. **Implement the EntityQuery properly.** The `suggestedEntities()` method is what surfaces when a user starts an Intent without specifying a parameter. Make it return the most relevant items, not just the first N.

3. **Write at least one Intent per core action.** Create, read, update, delete where relevant. The read Intents matter more than you think: they're what allows Apple Intelligence to pull data from your app into a larger workflow.

4. **Test in Shortcuts first.** Shortcuts is still the best sandbox for App Intents. If the Intent works well in Shortcuts (parameters resolve cleanly, execution is fast, the result dialog is clear), it will work well with Apple Intelligence.

---

## The strategic case

App stores have always rewarded apps that feel native. The rubber-band scroll. The swipe-back gesture. The standard sheet presentation. Users notice when apps respect platform conventions, even when they can't articulate why.

Apple Intelligence integration is becoming the new version of that signal. Apps that Apple Intelligence can reach into feel more capable. Apps it can't reach into feel isolated.

The teams treating App Intents as a checkbox for Shortcuts compliance are going to find themselves behind the teams that treated them as the AI integration layer they've now become.
