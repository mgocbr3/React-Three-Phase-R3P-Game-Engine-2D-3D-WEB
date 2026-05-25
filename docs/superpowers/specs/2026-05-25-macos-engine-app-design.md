# macOS Engine App Design

Date: 2026-05-25

## Goal

Create a first macOS app wrapper for the PixlPlayground engine so the editor can be tested as a desktop application without moving game projects into this repository.

This first pass is a development host: a small native macOS app opens the existing Studio web editor inside a `WKWebView` and uses the local engine dev server. It is meant to stabilize daily engine work, not to ship a final offline release.

## Non-Goals

- Do not commit or modify game runtime files, sample project files, or Pixlland game repo content.
- Do not introduce Electron.
- Do not package a production/offline editor bundle in this step.
- Do not add auto-update, signing, notarization, or installer packaging yet.
- Do not change gameplay code.

## Recommended Approach

Use a SwiftPM macOS app target in a clearly separated folder:

```text
apps/macos-engine/
  Package.swift
  Sources/PixlEngineApp/
    PixlEngineApp.swift
    AppDelegate.swift
    EngineWindowController.swift
    EngineWebViewController.swift
    DevServerController.swift
    AppConfig.swift
  README.md
script/
  build_and_run_macos_engine.sh
.codex/environments/environment.toml
```

The app is intentionally isolated from `apps/studio` and `packages/*`. It consumes the existing Studio through a local URL instead of importing or rewriting frontend code.

## App Behavior

1. On launch, the app opens a normal macOS window named `Pixl Engine`.
2. The app loads `http://localhost:8080/editor?engine=native` by default.
3. If a project URL is configured later, the app can load `sampleProject` or a local project route, but that is configuration only.
4. The app shows basic loading and failure states in native UI:
   - "Starting engine..."
   - "Waiting for Studio..."
   - "Could not connect to Studio"
5. The app does not write game files directly. File writes remain owned by the existing Studio/engine services.

## Dev Server Policy

For the first test, the app should prefer reliability over clever automation:

- The build/run script owns starting the Studio dev server.
- The Swift app only loads the configured URL and reports connection errors.
- The script kills/reuses the dev server process in a controlled way.
- The default port should be `8080` to match the current browser workflow.

This keeps the Swift app small and avoids embedding Node process management into the macOS binary too early.

## Build And Run Flow

Create a project-local script:

```text
script/build_and_run_macos_engine.sh
```

The script should:

1. Stop a previous `Pixl Engine` app process if it is running.
2. Ensure the Studio dev server is running on port `8080`.
3. Build the SwiftPM macOS app.
4. Stage a local `.app` bundle under `apps/macos-engine/dist/Pixl Engine.app`.
5. Launch the app bundle with `open -n`.
6. Support `--verify` to confirm the app process is alive.

This follows the macOS plugin guidance: GUI apps should be launched as `.app` bundles, not as raw SwiftPM executables.

## Codex Run Button

Update `.codex/environments/environment.toml` only after the script exists. The `Run` action should point to:

```text
./script/build_and_run_macos_engine.sh
```

The environment file is repo tooling, not app source. It should not contain game-specific paths.

## Comments And Documentation

Use comments only where they explain non-obvious boundaries:

- Why the app uses `WKWebView` instead of Electron.
- Why the Swift app does not own Node process lifecycle in v1.
- Why game files are not bundled into this repository.
- Why the launch script stages an `.app` bundle instead of launching the raw executable.

Every new folder gets a short README explaining ownership and how to run it.

## Tests And Verification

Minimum verification for this phase:

- `swift build` inside `apps/macos-engine`.
- `./script/build_and_run_macos_engine.sh --verify`.
- `pnpm engine:typecheck`.
- `pnpm engine:test` if engine/shared code changed.
- Manual browser/app check that the editor loads the existing `?engine=native` route.

The first pass does not require UI automation inside the macOS window. If launch is unstable, add process and log checks before adding more features.

## Risks

- WebKit may expose subtle differences from Chromium. Treat those as useful test signals, not as a reason to abandon the wrapper immediately.
- Local dev server startup can be flaky if hidden inside the app. Keeping startup in the script makes failures easier to see.
- File System Access API behavior differs in WebKit. The first test should focus on editor stability and viewport interaction, not production file import/export.

## Success Criteria

- The macOS app launches from one command.
- The editor loads in a native window.
- The app code is isolated under `apps/macos-engine`.
- No game project files are modified or committed.
- The repo has clear documentation for what was added and why.
