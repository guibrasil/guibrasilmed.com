---
title: "Structured concurrency in Swift: what actually changes"
description: "async/await is easy to adopt. Structured concurrency — task trees, cancellation, task groups — is where the real shift happens."
date: 2026-07-22
tags: [swift, concurrency, ios]
draft: false
---

Swift's concurrency model landed with a lot of fanfare around `async/await`, and most teams adopted the syntax quickly. But the deeper shift — structured concurrency — is subtler and more important. This is what I've found actually changes day-to-day after a year of writing concurrent Swift seriously.

## The problem with unstructured concurrency

Before `async/await`, most iOS codebases managed concurrency through completion handlers and `DispatchQueue`. The pattern works, but it creates unstructured code: fire a task, hope the callback runs, manually cancel if needed (and only if you remembered to write the cancellation logic).

The structural problem is that lifetimes aren't expressed in the code. You can't look at a function signature and know whether it spawns background work that outlives the call.

## What structured concurrency actually means

Structured concurrency means tasks have a defined scope. When the scope exits, its child tasks are cancelled and awaited. This is the same principle as structured programming — `if`, `for`, functions — applied to async work.

```swift
func loadDashboard() async throws -> Dashboard {
    async let user = fetchUser()
    async let feed = fetchFeed()
    return try await Dashboard(user: user, feed: feed)
}
```

Both `fetchUser` and `fetchFeed` run concurrently, but they are children of `loadDashboard`. If `loadDashboard` is cancelled — because the user navigated away — both children are cancelled automatically. You don't write cancellation logic. The structure enforces it.

## Task groups for dynamic concurrency

`async let` works when you know the number of concurrent tasks at compile time. For dynamic cases — processing an array of items concurrently — use `withTaskGroup`:

```swift
func fetchAll(ids: [String]) async throws -> [Item] {
    try await withThrowingTaskGroup(of: Item.self) { group in
        for id in ids {
            group.addTask { try await fetchItem(id: id) }
        }
        return try await group.reduce(into: []) { $0.append($1) }
    }
}
```

The group and all its tasks are scoped to the `withThrowingTaskGroup` call. When it returns, everything is done or cancelled.

## Where it still gets awkward

Actors solve data races but introduce their own friction. Crossing actor boundaries with `await` in tight loops is expensive. And `MainActor` inference can produce surprising behaviour when a class conforms to a protocol that isn't `MainActor`-isolated.

The model is sound. The ergonomics are still being worked out — each Swift release tightens them. The investment is worth it.

## The practical upshot

The shift in mindset is this: instead of thinking about threads and queues, think about task trees. Who owns this work? What cancels it? Where does the result go? Structured concurrency answers all three in the code structure itself, which makes concurrent Swift far easier to reason about than the `DispatchQueue` era.
