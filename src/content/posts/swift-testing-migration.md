---
title: "Migrating from XCTest to Swift Testing: what actually changes"
description: "Xcode 27.3 completes the Swift Testing story with UI test support. Here's what the migration actually looks like — and why the new mental model is worth the switch."
pubDatetime: 2026-11-20
tags: [swift, testing, ios, xcode]
ogImage: /images/swift-testing-cover.png
draft: true
---

iOS Dev Weekly's headline last week was blunt: "The age of XCTest is over." With Xcode 27.3 beta 2 shipping UI testing support for Swift Testing, that's not hyperbole anymore — it's just accurate. The last blocker is gone.

Depop just migrated 10,000+ unit tests with AI assistance. If that doesn't make you at least curious, I don't know what will.

Here's what the migration actually looks like.

---

## Why XCTest feels dated

XCTest was designed in a different era. It shows.

The API is stringly-typed in places that don't need to be. Failure messages are cryptic when they should be obvious. The `setUp`/`tearDown` dance is verbose boilerplate that you write without thinking, every single time. And parameterised tests — running the same test with multiple inputs — simply don't exist. You hand-roll them with loops, or you don't bother.

Here's a typical XCTest failure message when two arrays don't match:

```
XCTAssertEqual failed: ("["a", "b", "c"]") is not equal to ("["a", "b", "d"]")
```

Compare that to what Swift Testing shows you. Exactly which element differed, in context, without you having to decode the string dump yourself. That alone is worth the switch.

---

## The Swift Testing mental model

Three things to internalize:

- `#expect(condition)` — the universal assertion macro. It captures the expression so it can show you exactly what went wrong.
- `@Test` — marks a function as a test. No class required, no naming convention required, no inheriting from `XCTestCase`.
- `@Suite` — optional grouping. Use it when you want shared state or a logical namespace.

That's the whole API surface for the common case. The rest is ergonomics on top.

---

## Before/after: the patterns you use every day

### Basic assertions

```swift
// XCTest
XCTAssertEqual(result.count, 3)
XCTAssertTrue(user.isActive)
XCTAssertNil(response.error)

// Swift Testing
#expect(result.count == 3)
#expect(user.isActive)
#expect(response.error == nil)
```

The `#expect` macro takes any boolean expression. No more memorising which variant of `XCTAssert*` to use. When a check fails, the macro expands to show you the actual values on both sides of the operator — not just "false is not true".

### Setup and teardown

XCTest's `setUp` and `tearDown` are instance methods you override. Swift Testing uses Swift itself: `init` and `deinit`.

```swift
// XCTest
class CartTests: XCTestCase {
    var sut: ShoppingCart!

    override func setUp() {
        super.setUp()
        sut = ShoppingCart()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }
}

// Swift Testing
@Suite struct CartTests {
    var sut: ShoppingCart

    init() {
        sut = ShoppingCart()
    }

    // deinit runs automatically — no tearDown needed
    // for value types, there's nothing to tear down at all
}
```

Notice that `sut` is non-optional in the Swift Testing version. No more force-unwrapping your own test fixtures. Swift Testing creates a fresh instance of the suite struct for each test function, so isolation is free.

### Async tests

XCTest requires `async` on the test method and careful handling of continuations for older callback APIs. Swift Testing just... works.

```swift
// XCTest
func testFetchUser() async throws {
    let user = try await userService.fetch(id: "123")
    XCTAssertEqual(user.name, "Gui")
}

// Swift Testing
@Test func fetchUser() async throws {
    let user = try await userService.fetch(id: "123")
    #expect(user.name == "Gui")
}
```

Same shape, less ceremony. Swift Testing supports `async throws` natively — no `expectation(description:)`, no `waitForExpectations`, no XCTestExpectation at all for async work.

### Parameterised tests

This is the killer feature. XCTest has no equivalent.

```swift
// XCTest — you've probably written something like this
func testSlugGeneration() {
    let cases: [(input: String, expected: String)] = [
        ("Hello World", "hello-world"),
        ("Swift Testing", "swift-testing"),
        ("  Leading spaces  ", "leading-spaces"),
    ]
    for (input, expected) in cases {
        XCTAssertEqual(slugify(input), expected, "Failed for input: \(input)")
    }
}
// One test. One pass/fail. No granularity.

// Swift Testing
@Test("Slug generation", arguments: [
    ("Hello World",      "hello-world"),
    ("Swift Testing",    "swift-testing"),
    ("  Leading spaces  ", "leading-spaces"),
])
func slugGeneration(input: String, expected: String) {
    #expect(slugify(input) == expected)
}
```

Each argument set runs as a separate test. If the third case fails, the first two still pass and show green. You get individual failure messages with the actual inputs that caused the problem. No more "Failed for input: Leading spaces" buried in a wall of output.

This alone justifies the migration for any test suite that covers validation logic, formatters, or parsers.

### Expected throws

```swift
// XCTest
func testInvalidEmailThrows() {
    XCTAssertThrowsError(try validator.validate("not-an-email")) { error in
        XCTAssertEqual(error as? ValidationError, .invalidFormat)
    }
}

// Swift Testing
@Test func invalidEmailThrows() throws {
    #expect(throws: ValidationError.invalidFormat) {
        try validator.validate("not-an-email")
    }
}
```

The Swift Testing version is more readable and type-safe. `#expect(throws:)` checks both that an error was thrown and that it matches the expected value. If you only care that something throws without checking the specific error, use `#expect(throws: (any Error).self)`.

---

## UI testing: what just landed in Xcode 27.3

Until now, UI tests were the one thing keeping XCTest alive. You couldn't write `XCUIApplication` interactions with Swift Testing. That changes with Xcode 27.3 beta 2.

The new `UITestingSession` type is the entry point. It replaces `XCUIApplication` as the coordinator, but the query API you already know still works:

```swift
import Testing
import XCTest // still needed for XCUIElement, XCUIApplication

@Suite(.serialized) // UI tests must run serially
struct OnboardingUITests {
    @Test func completesOnboarding() async throws {
        let app = XCUIApplication()
        app.launch()

        let nameField = app.textFields["nameField"]
        #expect(nameField.exists)
        nameField.tap()
        nameField.typeText("Gui")

        app.buttons["Continue"].tap()

        #expect(app.staticTexts["Welcome, Gui"].waitForExistence(timeout: 3))
    }
}
```

The `.serialized` suite trait is important — UI tests interact with a running process, so they can't run in parallel. Swift Testing runs tests concurrently by default, so you need to opt out explicitly.

The `#expect` macro replaces `XCTAssert*` even inside UI tests. The mental model is consistent throughout.

---

## Migration strategy: don't rewrite everything at once

Swift Testing and XCTest coexist in the same target. You don't need a big-bang migration.

A practical approach:

1. **New tests go in Swift Testing.** Don't write another `XCTestCase` subclass. Every new test file uses `@Test` from day one.
2. **Migrate when you touch a file.** If you're fixing a bug in `CartTests.swift`, convert that file while you're in there. Boy scout rule.
3. **Prioritise parameterised candidates.** Find your loop-based tests and convert them first — they get the most visible benefit.
4. **Leave legacy UI tests for now.** If you're not on Xcode 27.3 yet, don't rush it. The old `XCUITest` subclass approach still works fine.

One thing to watch: `@Suite` structs get a new instance per test, which is different from `XCTestCase` where `setUp` runs before each test on the same instance. If you're sharing expensive state across tests (a database connection, a compiled regex), use a class-based suite or restructure.

---

## What XCTest still wins at

Honestly? Not much.

Performance tests with `measure {}` don't have a Swift Testing equivalent yet. If you're benchmarking code paths with `XCTMetric`, stay on XCTest for those specific tests.

The Xcode test report UI also still shows XCTest results slightly more prominently in some views, but that's a tooling detail that will close over time.

For everything else — unit tests, integration tests, now UI tests — Swift Testing is the better tool.

---

## The bottom line

The migration isn't about syntax. It's about a better mental model: tests as plain Swift functions, isolation through value semantics, failure messages that actually tell you what went wrong, and parameterisation as a first-class feature.

Xcode 27.3 removed the last excuse. Start with your next new test.
