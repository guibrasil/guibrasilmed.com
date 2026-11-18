---
title: "CI/CD for iOS with GitHub Actions and reusable workflows"
description: "How to build a reliable iOS pipeline on GitHub Actions and extract it into reusable workflows and composite actions you can share across every project."
pubDatetime: 2026-07-26
tags: [ios, ci-cd, github-actions, swift]
draft: false
---

Most iOS teams spend more time fighting their CI than writing code. Xcode versioning, code signing, simulator selection, derived data caching — each one is a small problem, but together they make iOS pipelines brittle and slow. GitHub Actions gives you enough control to fix all of it, and its reusable workflows let you do it once and apply it everywhere.

This is the setup I've landed on after running iOS CI across multiple projects simultaneously.

## The baseline workflow

Start with something that actually runs before you optimise it. The minimum viable iOS pipeline builds the app and runs the test suite on every push and pull request.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: macos-15

    steps:
      - uses: actions/checkout@v4

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_16.3.app

      - name: Run tests
        run: |
          xcodebuild test \
            -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
            -resultBundlePath TestResults \
            | xcpretty
```

Two things worth noting here. First, pin Xcode explicitly with `xcode-select` — GitHub's macOS runners ship with multiple Xcode versions, and the default changes without warning when Apple updates the runner image. Second, `xcpretty` makes the output readable; without it you're staring at thousands of lines of raw `xcodebuild` logs.

## Caching derived data and SPM packages

A cold iOS build with SPM dependencies can take 8–12 minutes. Caching brings that to under 2. There are two caches worth setting up: Swift Package Manager's resolved packages, and Xcode's derived data.

```yaml
      - name: Cache SPM packages
        uses: actions/cache@v4
        with:
          path: .build
          key: spm-${{ runner.os }}-${{ hashFiles('**/Package.resolved') }}
          restore-keys: spm-${{ runner.os }}-

      - name: Cache DerivedData
        uses: actions/cache@v4
        with:
          path: ~/Library/Developer/Xcode/DerivedData
          key: derived-${{ runner.os }}-${{ hashFiles('**/*.swift', '**/*.xccconfig') }}
          restore-keys: derived-${{ runner.os }}-
```

The cache key uses `Package.resolved` for SPM so it invalidates exactly when dependencies change. For derived data, hashing Swift sources gives a reasonable signal — you get a cache hit on unchanged code and a miss when something meaningful changes.

## Extracting a composite action

Once this works in one project, the temptation is to copy the YAML into every other repo. Don't. Instead, pull the reusable parts into a composite action you can reference from anywhere.

A composite action lives in a repo — either your app repo under `.github/actions/`, or a dedicated shared repo like `your-org/ios-actions`. The structure looks like this:

```
ios-actions/
  setup/
    action.yml       ← sets up Xcode and caches
  test/
    action.yml       ← runs xcodebuild test
  deploy/
    action.yml       ← builds archive and uploads to TestFlight
```

The `setup` action:

```yaml
# ios-actions/setup/action.yml
name: Setup iOS environment
description: Selects Xcode, restores SPM and DerivedData caches

inputs:
  xcode-version:
    description: Xcode app name to select
    required: false
    default: Xcode_16.3.app

runs:
  using: composite
  steps:
    - name: Select Xcode
      shell: bash
      run: sudo xcode-select -s /Applications/${{ inputs.xcode-version }}

    - name: Cache SPM packages
      uses: actions/cache@v4
      with:
        path: .build
        key: spm-${{ runner.os }}-${{ hashFiles('**/Package.resolved') }}
        restore-keys: spm-${{ runner.os }}-

    - name: Cache DerivedData
      uses: actions/cache@v4
      with:
        path: ~/Library/Developer/Xcode/DerivedData
        key: derived-${{ runner.os }}-${{ hashFiles('**/*.swift') }}
        restore-keys: derived-${{ runner.os }}-
```

Any project can now use this with one line:

```yaml
      - uses: your-org/ios-actions/setup@main
        with:
          xcode-version: Xcode_16.3.app
```

## Reusable workflows across repositories

Composite actions extract steps. Reusable workflows extract entire jobs — including the runner, environment, and job-level configuration. This is the right level of abstraction for an iOS pipeline.

In your shared repo, create a callable workflow:

```yaml
# ios-actions/.github/workflows/ios-ci.yml
name: iOS CI (reusable)

on:
  workflow_call:
    inputs:
      scheme:
        required: true
        type: string
      xcode-version:
        required: false
        type: string
        default: Xcode_16.3.app
    secrets:
      MATCH_PASSWORD:
        required: false
      APP_STORE_CONNECT_API_KEY:
        required: false

jobs:
  build-and-test:
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/ios-actions/setup@main
        with:
          xcode-version: ${{ inputs.xcode-version }}
      - name: Run tests
        run: |
          xcodebuild test \
            -scheme ${{ inputs.scheme }} \
            -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
            | xcpretty
```

Calling it from any project is two lines:

```yaml
# your-app/.github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  ci:
    uses: your-org/ios-actions/.github/workflows/ios-ci.yml@main
    with:
      scheme: MyApp
    secrets: inherit
```

`secrets: inherit` passes the calling repo's secrets into the reusable workflow without listing them individually — essential for signing credentials that differ per project.

## Code signing with Fastlane match

Signing is where most iOS pipelines fall apart. The cleanest approach in CI is Fastlane match with a certificates repo: match stores encrypted certificates and profiles in a private repo, and your pipeline clones and installs them at build time.

Add a signing step to your reusable workflow:

```yaml
      - name: Install certificates via match
        env:
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_BASIC_AUTHORIZATION: ${{ secrets.MATCH_GIT_TOKEN }}
        run: bundle exec fastlane match appstore --readonly
```

`--readonly` is important in CI — you never want the pipeline to regenerate or revoke certificates. It fetches what's already there and installs it into the keychain.

## Deploying to TestFlight

The deploy job should be separate from the test job and only run on pushes to `main`. Keep it gated so every PR doesn't trigger an upload.

```yaml
  deploy:
    needs: build-and-test
    runs-on: macos-15
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/ios-actions/setup@main

      - name: Install certificates
        env:
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_BASIC_AUTHORIZATION: ${{ secrets.MATCH_GIT_TOKEN }}
        run: bundle exec fastlane match appstore --readonly

      - name: Build and upload
        env:
          APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          APP_STORE_CONNECT_API_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          APP_STORE_CONNECT_API_KEY_CONTENT: ${{ secrets.ASC_PRIVATE_KEY }}
        run: bundle exec fastlane deliver_testflight
```

The App Store Connect API key is the right credential here — it doesn't expire like Apple ID sessions do, which is what breaks most pipelines six months after you set them up.

## What this looks like across multiple projects

Once the shared repo exists, adding CI to a new iOS project takes about five minutes: create `.github/workflows/ci.yml`, point it at the reusable workflow, pass the scheme name, and done. The caching, signing, and deployment logic is maintained in one place.

When you need to bump Xcode — which happens every major release cycle — you change the default in the shared action and every project picks it up on the next run. No hunting through repos.

The upfront investment in the shared repo pays back quickly. The third project you set up with it will have taken less total effort than the first project did with bespoke YAML.
