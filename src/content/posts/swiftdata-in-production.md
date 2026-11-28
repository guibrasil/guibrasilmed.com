---
title: "SwiftData in production: the honest version"
description: "SwiftData is good. It's also not finished. Here's what actually breaks, what you have to work around, and when to reach for Core Data anyway."
pubDatetime: 2026-11-28
tags: [swift, swiftdata, ios, coredata]
ogImage: /images/swiftdata-cover.png
draft: false
---

I shipped SwiftData in a real app. Not a demo. Not a WWDC sample project. A production app that users open every day.

Here's what I found.

## What SwiftData promises

The pitch is simple: Core Data ergonomics without the XML model editor, the `NSManagedObjectContext` juggling, the `fetchRequest` boilerplate. You write Swift models, decorate them with macros, and the framework handles the rest.

```swift
@Model
final class Track {
    var title: String
    var artist: String
    var addedAt: Date

    init(title: String, artist: String, addedAt: Date = .now) {
        self.title = title
        self.artist = artist
        self.addedAt = addedAt
    }
}
```

That's it. No `.xcdatamodeld`. No `NSManagedObject` subclass. It's genuinely good.

## What's actually good

**`@Model` works.** The macro expansion is clean, the Swift-native syntax reduces friction, and you spend less time fighting the framework and more time building features.

**`@Query` is a great idea.** Fetching data in a SwiftUI view goes from a dozen lines of `NSFetchRequest` configuration to this:

```swift
@Query(sort: \Track.addedAt, order: .reverse)
var tracks: [Track]
```

The view automatically updates when the underlying data changes. It just works.

**`VersionedSchema` is the migration story you always wanted.** Defining schema versions as nested enums, then writing lightweight migrations as a `SchemaMigrationPlan`, is the clearest migration API Apple has shipped for persistence. The structure forces you to think in discrete versions instead of making ad-hoc changes and hoping nothing breaks.

```swift
enum AppSchema: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] { [Track.self] }

    @Model final class Track {
        var title: String
        var artist: String
        // ...
    }
}
```

Good stuff. Now for the sharp edges.

## The gotchas

### `@Attribute(.unique)` breaks CloudKit sync silently

This one cost me a day.

```swift
@Model
final class Track {
    @Attribute(.unique) var spotifyID: String
    // ...
}
```

Reasonable thing to want. Turns out CloudKit sync requires that every attribute be optional or have a default value. `@Attribute(.unique)` violates CloudKit's constraint model in ways that SwiftData does not warn you about at compile time or at runtime: it just silently stops syncing.

The fix: drop `.unique` and enforce uniqueness in your own insertion logic.

```swift
func insert(_ track: Track, into context: ModelContext) throws {
    let id = track.spotifyID
    let existing = try context.fetch(
        FetchDescriptor<Track>(predicate: #Predicate { $0.spotifyID == id })
    )
    guard existing.isEmpty else { return }
    context.insert(track)
}
```

More code. No mysterious sync failures.

### Cascade delete behaviour is not obvious

Add a relationship and you get cascade deletes, sometimes. It depends on how you declared the relationship and whether the inverse is set up correctly.

```swift
@Model
final class Playlist {
    var name: String
    @Relationship(deleteRule: .cascade) var tracks: [Track] = []
}
```

The `deleteRule: .cascade` is explicit and clear. The problem is what happens when you delete a `Track` that belongs to a `Playlist` without an explicit rule on the other side. In Core Data you got a validation error at save time. In SwiftData you sometimes get a dangling reference and no crash.

Always declare your delete rules. Both directions. Don't rely on defaults.

### Complex predicates hit a wall

`#Predicate` is elegant until it isn't. Not all valid Swift expressions compile to predicates. The macro only supports a subset of operations that can be translated to SQL.

```swift
// This works
let predicate = #Predicate<Track> { $0.artist == "Radiohead" }

// This does NOT compile to a predicate
let lowercased = "radiohead"
let predicate = #Predicate<Track> { $0.artist.lowercased() == lowercased }
```

String transformations, custom comparators, computed properties: they're all off-limits inside `#Predicate`. When you hit the wall, you have two options: restructure your model to store a pre-computed field (store a `searchableArtist` lowercased string alongside `artist`), or fetch a broader set and filter in memory.

Neither is great. It's a real limitation and the error messages aren't always helpful.

### Large datasets expose the performance ceiling

SwiftData is not Core Data. It's built on top of Core Data, but the abstraction layer has overhead. For most apps (dozens to a few hundred records) you won't notice. For thousands of records with complex relationships and frequent queries, you will.

My threshold: around 2,000 records with multi-hop relationship traversal, SwiftUI list scroll performance degraded noticeably. The fix was to drop down to Core Data's `NSFetchRequest` with batch sizes and `returnsObjectsAsFaults`.

You can mix SwiftData and Core Data in the same app. The underlying persistent store is shared. It's not pretty, but it works.

```swift
// Access the underlying NSManagedObjectContext from a ModelContext
let context = modelContext.container.mainContext
```

If your app has a large dataset from day one, factor this in before you start.

### SwiftUI previews require a ModelContainer setup

This is annoying but solvable. Previews crash unless you inject a `ModelContainer`. The in-memory configuration is your friend.

```swift
#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(
        for: Track.self,
        configurations: config
    )
    let context = container.mainContext
    context.insert(Track(title: "Creep", artist: "Radiohead"))

    return TrackListView()
        .modelContainer(container)
}
```

I wrapped this into a small helper to avoid repeating it across every preview:

```swift
extension ModelContainer {
    static var preview: ModelContainer {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        return try! ModelContainer(for: Track.self, configurations: config)
    }
}
```

Then every preview is just `.modelContainer(.preview)`. Simple once you do it once.

### Thread safety: `@ModelActor` and when you need it

The default `ModelContext` from `.mainContext` is main-thread bound. If you're doing background imports or heavy processing, you need a separate context running on a background actor.

`@ModelActor` is the SwiftData-native way to do this:

```swift
@ModelActor
actor LibraryImporter {
    func importTracks(_ incoming: [TrackDTO]) throws {
        for dto in incoming {
            let track = Track(title: dto.title, artist: dto.artist)
            modelContext.insert(track)
        }
        try modelContext.save()
    }
}
```

The `@ModelActor` macro creates a dedicated `ModelContext` tied to the actor's execution context. This is the right pattern for anything non-trivial that touches persistence off the main thread.

The gotcha: objects fetched in a `@ModelActor` context cannot be passed across actor boundaries. You'll get a Swift concurrency warning or a crash. Pass identifiers (`PersistentIdentifier`) instead, then re-fetch in the target context.

```swift
// Don't do this
let track = try context.fetch(...).first // in background actor
await MainActor.run { self.selectedTrack = track } // crash

// Do this
let trackID = try context.fetch(...).first?.persistentModelID
await MainActor.run {
    self.selectedTrack = mainContext.model(for: trackID!)
}
```

## The migration story is good, but the docs undersell the complexity

`VersionedSchema` and `SchemaMigrationPlan` are genuinely well-designed APIs. The issue is that the documentation covers the happy path: rename a property, add a default, done.

Real migrations are messier. When you need to transform data, not just reshape the schema, you write a `MigrationStage.custom` with a `willMigrate` or `didMigrate` closure. That closure gives you access to a `ModelContext` for the source schema. It works, but the documentation for this case is thin, and it's easy to write a migration that runs successfully and silently drops data.

My advice: test migrations on a copy of real production data before shipping. The simulator is not enough. Use `XCTestCase` with an on-disk store seeded to match your previous schema, then verify record counts and relationships after migration.

## The verdict

Use SwiftData for new apps on iOS 17+. The developer experience is genuinely better than Core Data for the common case. `@Model`, `@Query`, and `VersionedSchema` are wins that more than justify the switch.

Go in knowing the sharp edges: CloudKit sync has silent constraints, cascade deletes need explicit configuration, complex predicates have hard limits, large datasets will push you toward Core Data internals, and thread safety requires deliberate use of `@ModelActor`.

It's not finished. It's also not broken. It's a first-generation framework that Apple is iterating on, and the foundation is solid.

For an app you're starting today targeting iOS 17 and above, I'd choose SwiftData. For a large existing Core Data app, I'd migrate incrementally and only where the ergonomics make a meaningful difference.

The honest version: it's good, and knowing where it bites means it's safe to ship.
