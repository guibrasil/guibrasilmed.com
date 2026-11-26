---
title: "Swift 6.2: what actually matters"
description: "Raw identifiers, task naming, improved backtraces. Here's what Swift 6.2 actually changes day-to-day, and what you can safely ignore."
pubDatetime: 2026-11-22
tags: [swift, ios]
ogImage: /images/swift-62-cover.png
draft: true
---

Swift 6.2 isn't a big-bang release. No concurrency overhaul, no new type system features that break everything you wrote last month. What it brings is a set of focused improvements that solve specific, annoying problems. Some you'll use immediately. Some are niche but important when you need them.

Here's what actually matters.

## Raw identifiers

Swift has always let you escape reserved words with backticks (like `let \`class\` = "UIView"`), but 6.2 extends this to work consistently across all identifier positions, including places where the compiler previously choked or produced confusing errors.

The practical win is in two areas: DSLs and test names.

**DSLs.** If you're writing a result-builder DSL or a fluent API that reads like natural language, you sometimes want keywords as method names. Before 6.2, you'd work around the limitation with underscores or awkward synonyms.

```swift
// Before: awkward workaround
func `do`(_ action: () -> Void) { action() }
// Compiler accepted it in some positions, rejected it in others
```

```swift
// After: consistently works
struct Query {
    func `where`(_ condition: Predicate) -> Query { ... }
    func `in`(_ scope: Scope) -> Query { ... }
    func `if`(_ flag: Bool, _ transform: (Query) -> Query) -> Query { ... }
}

let result = Query()
    .`where`(user.isActive)
    .`in`(.global)
    .`if`(isAdmin) { $0.including(.adminFields) }
```

**Test names.** XCTest method names have to start with `test`, but Swift Testing lets you name tests anything. The problem is that descriptive test names often want to say things like "given the user is logged in, when they tap logout, then the session ends," and that often means using words that are keywords.

```swift
// Swift Testing — now valid
@Test func `if token expires, refresh before request`() async throws { ... }
@Test func `for each pending item, sync fires once`() async throws { ... }
```

This is a small quality-of-life change. But if you write Swift Testing tests, you'll use it immediately.

## Task naming

Before 6.2, debugging concurrent code meant reading thread backtraces with no context. You'd see a dozen `Task` entries in Instruments or the debugger with no way to know which task was which.

```swift
// Before: anonymous, invisible in the debugger
Task {
    await syncUserProfile()
}

Task {
    await prefetchFeed()
}
```

6.2 adds a `name` parameter to `Task` and `TaskGroup.addTask`.

```swift
// After: named tasks show up in Instruments and crash logs
Task(name: "sync-user-profile") {
    await syncUserProfile()
}

Task(name: "prefetch-feed") {
    await prefetchFeed()
}

// Works in task groups too
try await withThrowingTaskGroup(of: Item.self) { group in
    for id in ids {
        group.addTask(name: "fetch-item-\(id)") {
            try await fetchItem(id: id)
        }
    }
}
```

The name surfaces in Instruments time traces, in the debugger's thread list, and in crash reports. If you're running any kind of background sync, networking, or data pipeline, name your tasks. Future you, staring at a crash log at 11pm, will be grateful.

This should be a habit, not an afterthought. Add names to every `Task` you create.

## Improved backtraces

Swift 6.2 ships improved symbolic backtrace support, with better demangling and frame resolution, particularly for async functions and actor-isolated code, where stack traces have historically been nearly unreadable.

Before, a crash in async code could produce frames like:

```
frame #3: 0x00000001045a3c10 MyApp`partial apply for closure #1 in MyViewModel.load() + 48
frame #4: 0x00000001045a3c40 MyApp`reabstraction thunk helper from @escaping...
```

After 6.2, the same crash shows:

```
frame #3: MyApp`MyViewModel.load() async -> ()
frame #4: MyApp`ProfileView.body.getter
```

This isn't a code change; you don't adopt it, you just benefit from it. But it compounds with task naming. Named tasks + improved backtraces means you can actually read a crash report from concurrent code and understand what happened.

## `@_used` attribute

This one is niche but solves a real problem if you've hit it.

The linker strips unused symbols by default. That's usually fine. But sometimes you have symbols that *look* unused (no call site in Swift code) but are referenced at runtime: via Objective-C, via `dlsym`, via a plugin system, or via a registration pattern.

```swift
// Before: the linker silently strips this, your plugin system breaks at runtime
class MyPlugin: NSObject, PluginProtocol {
    static func register() {
        PluginRegistry.shared.register(MyPlugin.self)
    }
}
// You'd work around this with @objc, -ObjC linker flag, or force a fake reference
```

```swift
// After: opt out of stripping explicitly
@_used
class MyPlugin: NSObject, PluginProtocol {
    static func register() {
        PluginRegistry.shared.register(MyPlugin.self)
    }
}
```

The `@_used` attribute is spelled with an underscore because it's technically underscored (not yet formally stable API), but it's supported and intentional. If you're building modular apps with plugin architectures, dynamic feature registration, or anything that uses `@objc` registration patterns without explicit call sites, this is worth knowing.

Most apps won't need it. When you do need it, you'll know: it'll be a "my code vanishes at runtime" bug.

## Noncopyable improvements

Swift's `~Copyable` story has been evolving since 5.9. 6.2 continues that by allowing `~Copyable` conformances in more generic contexts; specifically, more protocol constraints and conditional conformances now work correctly with noncopyable types.

```swift
// Before: this would produce a compiler error or require workarounds
protocol Resource: ~Copyable {
    func release()
}

struct FileHandle: ~Copyable, Resource {
    private let fd: Int32
    consuming func release() { close(fd) }
}

func use<R: Resource & ~Copyable>(_ resource: consuming R) {
    resource.release() // Previously tricky to express generically
}
```

```swift
// After: compiles cleanly
func use<R: Resource & ~Copyable>(_ resource: consuming R) {
    resource.release()
}
```

For most app developers, noncopyable types are still fairly exotic. Where they matter: file handles, network connections, cryptographic contexts, anything where accidental copying is a bug, not a performance concern. If you're wrapping low-level C APIs, `~Copyable` gives you compile-time enforcement of single-ownership semantics.

## What you can safely ignore

**Compile-time constant improvements.** Useful if you're doing embedded Swift or writing compiler plugins. For app developers, this doesn't change day-to-day work. The existing `#if` and `@_const` machinery works the same way; 6.2 expands what's expressible in those contexts.

The theme in 6.2 is ergonomics. These aren't new paradigms: they're the runtime story getting better (backtraces, task naming) and the language removing friction in specific corners (raw identifiers, noncopyable generics). Adopt the naming habit today. Everything else you'll reach for when you need it.
