---
title: "Why teams are coming back to native (and what took so long)"
description: "Wave rebuilt their app in Swift and Kotlin. They're not alone. Here's what's actually driving the shift back to native iOS development."
pubDatetime: 2026-11-21
tags: [swift, ios, react-native, flutter, architecture]
ogImage: /images/native-vs-xp-cover.png
draft: false
---

Wave rebuilt their entire mobile app from scratch. Not a rewrite to a new cross-platform framework: a full migration back to native Swift and Kotlin. The kind of decision that takes months of internal debate and a non-trivial engineering budget to execute.

They shipped. Then they rebuilt. That's worth understanding.

## The promise that made sense at the time

The pitch for cross-platform has always been economically clean: hire one team, write one codebase, ship to both platforms simultaneously. For a startup burning cash trying to reach mobile users on iOS and Android, that tradeoff felt like a no-brainer.

React Native made it credible. Facebook was using it in production. Instagram integrated it. Airbnb gave it a serious shot. The 2015–2019 era of React Native adoption wasn't cargo-cult thinking; it was rational companies making a reasonable bet that JavaScript could get close enough to native performance that the productivity gains would outweigh the gaps.

Flutter came along a few years later with a different thesis: forget the bridge entirely, compile to native ARM code, render with your own engine. Google backed it hard. It addressed the core performance complaints about React Native. The pitch got better.

For a certain class of app (simple CRUD, content display, modest animations), the pitch delivered.

## What actually breaks

Here's the problem. "Close enough" erodes in ways that are hard to predict at the start of a project and expensive to fix later.

**Platform feel.** iOS users have expectations baked in at a motor-memory level. The rubber-band scroll. The swipe-back gesture on navigation. The way a sheet dismisses. These behaviors aren't just aesthetic: they signal to users that the app belongs on their phone. Cross-platform frameworks have gotten better at faking this. But "better at faking" is not the same as native. Users notice even when they can't articulate what's wrong. The app feels slightly off, and slightly off is enough to hurt retention.

**Performance edge cases.** The 60fps list scroll with 500 items. The camera pipeline that needs to be frame-perfect. Complex animations that need to stay in sync with gesture velocity. This is where the abstraction layer starts costing you. You're not writing Swift or Kotlin anymore; you're writing abstractions that compile to something that eventually talks to the platform. Every layer you add is another place where performance can leak.

**Debugging across two runtimes.** A crash in a React Native app can be in JavaScript, in the bridge, in the native module, or in the third-party library that wraps a native SDK. When it's in a third-party library that wraps a native SDK and you're on a device-specific OS version, good luck. The debugging surface area is massive. Tools have improved, but you're still context-switching between JavaScript debugging, native crash logs, and bridge trace output.

**OS release lag.** Every year Apple and Google ship new APIs. Live Activities. StandBy mode widgets. Dynamic Island support. The interactive lock screen on Android. Cross-platform frameworks don't ship day-one support, and they can't. They depend on community maintainers or the core team adding wrappers for new APIs. So your app always lags a release cycle behind whatever Apple or Google just announced. For most apps, fine. For apps competing at the top of the App Store, that lag matters.

**Hiring.** This one doesn't get talked about enough. The best iOS engineers know Swift deeply. They care about the platform. They follow WWDC. They have opinions about SwiftUI vs UIKit. Many of them don't want to write JavaScript on mobile. If you're cross-platform, you're fishing in a different, and in some ways shallower, talent pool. React Native expertise correlates more with JavaScript background than iOS platform depth. That's a real tradeoff when you're trying to build something technically sophisticated.

## The hidden cost nobody budgets for

Here's what the "write once, ship twice" math misses: maintaining a cross-platform abstraction is itself maintenance work.

React Native upgrades have historically been painful. The architecture changed significantly with the New Architecture migration (Fabric renderer, JSI, Codegen). Companies with large React Native codebases spent engineering months on that migration, not to add features, just to keep up. Flutter has a better track record here, but even Flutter codebases carry the overhead of updating to new Dart versions, handling breaking changes in platform-specific packages, and managing the gap between what Flutter's widget system can express and what your designers actually want.

You're not just building the app. You're maintaining the bridge between your app and the two platforms underneath it. That bridge has a carrying cost. The older the codebase, the higher the cost.

## Wave's story

Wave's fintech app started cross-platform. It made sense: they needed iOS and Android parity, they were moving fast, and the core flows were structured enough that a shared codebase worked. But fintech is a category where the quality bar is high and the trust threshold is unforgiving. Users are moving money. Friction loses them permanently.

The rebuild wasn't about cross-platform being wrong in principle. It was about the gap between what their users expected and what the abstraction layer could consistently deliver. Performance, feel, and the ability to integrate tightly with platform security features all played into it. They rebuilt in Swift and Kotlin, accepted the cost of two codebars, and bet that the quality gain was worth it.

They're not alone. Airbnb wrote a detailed post-mortem when they moved away from React Native in 2018. The points they raised (technical debt, the bridge as a bottleneck, debugging complexity, hiring difficulty) are the same points companies are still raising. The specific tools have improved. The fundamental tension hasn't changed.

## To be fair: cross-platform has gotten genuinely better

This isn't a "cross-platform is bad" piece. That would be lazy.

React Native's New Architecture is a real improvement. The bridge elimination via JSI means native code can call JavaScript without the async serialization overhead that caused jank in earlier versions. Expo has matured into a genuinely good developer experience for shipping fast.

Flutter's performance story is strong. The Impeller rendering engine replaced Skia and eliminated the shader compilation jank that plagued earlier Flutter apps. For apps that don't need to match platform idioms closely (games, design-forward consumer apps, enterprise tools), Flutter is a serious option.

The ecosystem has also matured around both platforms. The package support, debugging tooling, and community knowledge are vastly better than they were in 2018. If you're evaluating React Native today, you're not making the same bet Airbnb made.

## When cross-platform still makes sense

Internal tooling. Utility apps. MVPs where shipping fast matters more than shipping perfect. Teams without iOS/Android specialists on staff. Apps with simple, stable UI that doesn't need to push platform boundaries.

If your primary competitive advantage isn't the mobile experience itself, if the mobile app is a window into a service and not the service itself, cross-platform is a defensible choice. Build the simplest thing that works. Don't over-engineer the platform decision.

The mistake is using cross-platform as a default for user-facing consumer apps where the experience is the product. That's where the tradeoff consistently bites.

## The SwiftUI moment

One thing that genuinely changed the native calculus: SwiftUI.

Before SwiftUI, writing native iOS was slow. UIKit is powerful, but verbose. Autolayout is expressive but tedious. The gap between "I have a design" and "I have that design in UIKit" was wide enough that cross-platform's productivity argument had real weight.

SwiftUI changed that. Declarative syntax, live previews, composable components, tight integration with Swift concurrency. The speed at which you can build a polished iOS interface in SwiftUI today is legitimately close to what you'd get in React Native, with the full platform as your foundation instead of an abstraction on top of it. The old productivity argument for cross-platform has weakened considerably on the iOS side.

Kotlin Compose made a similar move on Android. The two platforms converged on a modern, declarative UI paradigm at roughly the same time. That's not a coincidence; it's the platforms responding to what developers actually needed.

## My take

Native is the default for anything user-facing where quality matters.

That doesn't mean cross-platform is wrong. It means it's not automatically right. The burden of proof should be on the cross-platform choice, especially for consumer apps, especially for fintech, especially for anything where the experience is what you're selling.

The pattern of teams rebuilding back to native isn't nostalgia. It's the market giving feedback. Wave gave that feedback loudly. Airbnb gave it before them. There will be others.

The frameworks will keep improving. The fundamental tension between abstraction and platform depth will stay. Build accordingly.
