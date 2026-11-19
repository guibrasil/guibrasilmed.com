---
title: "What AI gets wrong in Swift (and how to fix it)"
description: "A practical field guide to the patterns AI tools consistently get wrong in Swift and SwiftUI — with bad code, fixes, and the one-line reason each one matters."
pubDatetime: 2026-11-19
tags: [swift, swiftui, ios, ai]
draft: false
---

I use AI tools every day. Cursor, Claude, Copilot — all of them. They're genuinely useful for scaffolding, boilerplate, and the kind of code I'd otherwise write on autopilot. But I've been reviewing AI-generated Swift long enough to recognise the patterns in what they consistently get wrong. Same mistakes, different projects, different tools.

This is not an "AI bad" article. It's a field guide. These are the things I check for the moment a PR has that AI-shaped smell — confident, compiling, and subtly wrong.

---

## Observation & State

### `ObservableObject` and friends are the giveaway

This is the clearest signal that the model's training data skews old. Every AI I've tried defaults to this:

```swift
// AI-generated, every time
class ViewModel: ObservableObject {
    @Published var items: [Item] = []
    @Published var isLoading = false
}

struct MyView: View {
    @StateObject private var vm = ViewModel()
}
```

This compiles and runs. It also predates iOS 17. The modern replacement:

```swift
// What you actually want
@Observable
class ViewModel {
    var items: [Item] = []
    var isLoading = false
}

struct MyView: View {
    @State private var vm = ViewModel()
}
```

`@Observable` is a macro, not a protocol. No `@Published` on every property. No `@StateObject` / `@ObservedObject` split to manage. SwiftUI tracks granular property access instead of invalidating the whole view on any change. This is a real performance win, not just a cosmetic upgrade.

If your minimum deployment target is iOS 17 — and it should be by now — there is no reason to reach for `ObservableObject`.

### Computed properties for view decomposition

This one is subtle and I see it a lot. The model wants to keep code "clean" by extracting view chunks into computed properties:

```swift
struct ContentView: View {
    @State private var vm = ViewModel()

    // Looks harmless
    var header: some View {
        Text(vm.title).font(.headline)
    }

    var body: some View {
        VStack {
            header
            List(vm.items) { ... }
        }
    }
}
```

The problem: `header` is not a separate view. It's a computed property on `ContentView`. When *anything* in `ContentView` changes, `header` re-evaluates. You've also broken the precise observation tracking that `@Observable` relies on. SwiftUI tracks which properties are accessed inside a view's `body`. Computed properties on the parent view are inside the parent's body, so the parent owns the observation — not the extracted piece.

Fix: make it a proper view.

```swift
struct HeaderView: View {
    let title: String

    var body: some View {
        Text(title).font(.headline)
    }
}
```

Pass in what it needs. That's the whole model.

---

## Deprecated APIs

### `foregroundColor()` → `foregroundStyle()`

```swift
// Deprecated
Text("Hello").foregroundColor(.blue)

// Correct
Text("Hello").foregroundStyle(.blue)
```

`foregroundStyle()` accepts `ShapeStyle`, which means gradients, materials, and hierarchical styles all work. `foregroundColor()` is still there for compatibility, still compiles, still does nothing useful that `foregroundStyle()` doesn't do better.

### `cornerRadius()` → `clipShape`

```swift
// Deprecated
Image("cover").cornerRadius(12)

// Correct
Image("cover").clipShape(.rect(cornerRadius: 12))
```

`cornerRadius()` has been a soft deprecation for a while and a hard one since iOS 18. `clipShape` with `.rect(cornerRadius:)` does the same thing, works with continuous curves by default, and is composable with the rest of the shape system.

### `NavigationView` → `NavigationStack`

```swift
// 2019 called
NavigationView {
    ContentView()
}

// Current
NavigationStack {
    ContentView()
}
```

`NavigationView` has a list of well-documented problems — the split-view behaviour on iPad, the double-column issue, the fact that programmatic navigation was a nightmare. `NavigationStack` with a path solves all of it. If the model gives you `NavigationView`, flag it immediately.

### `onChange(of:)` with the old 1-parameter closure

Swift 5.9 changed the closure signature:

```swift
// Old — the closure receives the new value
.onChange(of: vm.query) { newValue in
    search(newValue)
}

// Current — no parameter, or old + new
.onChange(of: vm.query) {
    search(vm.query)
}

// Or if you need both
.onChange(of: vm.query) { oldValue, newValue in
    guard oldValue != newValue else { return }
    search(newValue)
}
```

The old form is deprecated. Xcode will warn about it, but AI tools generate it constantly because it's the form in almost all pre-2024 tutorial content.

---

## Concurrency

### `DispatchQueue.main.async` → `MainActor`

```swift
// GCD-era code
func loadItems() {
    Task {
        let result = await api.fetchItems()
        DispatchQueue.main.async {
            self.items = result
        }
    }
}
```

This mixes GCD and Swift Concurrency. It works, but it's the wrong abstraction layer.

```swift
// Swift Concurrency way
@MainActor
func loadItems() async {
    items = await api.fetchItems()
}
```

If your class or view model is marked `@MainActor`, every property mutation is already on the main actor. No manual dispatch needed. Mark the whole type, not individual methods, unless you have a specific reason to mix.

### `Task.sleep(nanoseconds:)` → `Task.sleep(for:)`

```swift
// Readable by humans? Barely.
try await Task.sleep(nanoseconds: 2_000_000_000)

// Readable by humans
try await Task.sleep(for: .seconds(2))
```

The nanoseconds API was the original. `Duration`-based sleep was added in Swift 5.7. Any model still generating the nanoseconds form is working from old training data. Same outcome, vastly worse to read.

### Excessive `@MainActor` annotation

Flip side of the previous point: I see AI-generated code that slaps `@MainActor` on everything — every method, every class — as if it were a defensive measure.

```swift
// Unnecessary — actor isolation is already inherited from @MainActor on the type
@MainActor
class ViewModel {
    @MainActor func updateState() { ... }   // redundant
    @MainActor var items: [Item] = []       // redundant
}
```

If the type is `@MainActor`, its members are already main-actor-isolated. Repeating it everywhere is noise, and it can mask real isolation bugs because everything looks annotated whether or not the annotation is doing anything.

---

## Layout & Views

### `GeometryReader` for things `containerRelativeFrame` now handles

This is the one that generates the most unnecessary complexity. AI models reach for `GeometryReader` as the answer to anything size-related:

```swift
// AI-generated: GeometryReader for a simple proportional size
GeometryReader { proxy in
    Rectangle()
        .fill(.blue)
        .frame(width: proxy.size.width * 0.8)
}
```

`GeometryReader` takes up all available space, can break layout, and forces a size-reading pass. For proportional sizing relative to a container, iOS 17 gave us `containerRelativeFrame`:

```swift
Rectangle()
    .fill(.blue)
    .containerRelativeFrame(.horizontal) { size, _ in size * 0.8 }
```

Cleaner. No layout side effects. Only reach for `GeometryReader` if you genuinely need to respond to geometry in ways `containerRelativeFrame`, `.frame(maxWidth:)`, or layout priorities can't handle.

### `onTapGesture` instead of `Button`

```swift
// Works, but breaks accessibility
Text("Submit")
    .onTapGesture { submit() }

// Correct
Button("Submit") { submit() }
```

`Button` is interactive by default. VoiceOver identifies it as a button. It responds to keyboard focus. It participates in the button role in the accessibility tree. `onTapGesture` does none of that. If you're making something tappable, it should almost always be a `Button`. Use `onTapGesture` for genuinely custom gesture interaction, not for building interactive elements from scratch.

---

## The hallucination section

Every AI tool will occasionally invent APIs. The pattern is always the same: the name sounds right, the method signature is plausible, the usage makes intuitive sense, and it doesn't exist.

Recent examples I've actually seen:
- `.searchable(prompt:)` — the modifier exists, but `prompt` takes `Text`, not a `String` directly
- Modifier chaining orders that compile but have no effect (`.padding().background()` vs `.background().padding()`)
- SPM targets with names that follow Apple's patterns but were removed or never shipped
- `Environment` values that sound like they should exist (`\.colorSchemeContrast` is real; variations on it are not)

The fix is boring: **always check the docs**. Option-click in Xcode. If the autocomplete doesn't suggest it, that's a signal. If it does suggest it but the documentation hover is thin or missing, verify before shipping.

---

## How I catch these in practice

A few habits that pay off:

**An `AGENTS.md` in the repo.** I keep a file at the project root (sometimes called `AGENTS.md` or included in `CLAUDE.md`) that tells AI tools what iOS version I'm targeting, what patterns to follow, and what deprecated APIs to avoid. Something like: *"Target iOS 17+. Use `@Observable` not `ObservableObject`. Use `NavigationStack` not `NavigationView`."* Models that read context files will follow these. It's not foolproof but it cuts the noise by half.

**Xcode warnings are your first line.** Most of the deprecated API mistakes in this article produce warnings. Treat them as errors. A PR with Xcode warnings in AI-generated code means the author didn't build and run it.

**A mental checklist during review.** When I see a large block of AI-shaped code, I scan for: `ObservableObject`, `NavigationView`, `DispatchQueue.main`, `foregroundColor`, `cornerRadius`. Those five alone catch the majority of issues.

---

The take is this: AI tools are a multiplier on what you already know. They make a senior engineer faster. They make a junior engineer produce senior-looking code that may or may not work correctly. The difference is whether the person reviewing — or writing — knows the platform well enough to catch what the model missed.

These mistakes aren't going to kill your app. They'll make it slower to maintain, harder to reason about, and subtly wrong in ways that show up at the worst times. Knowing the platform isn't optional just because the tool compiles.
