# ADR-004: Native Engine Integration + Agent Protocol (Vibe Coding First)

**Status:** Proposed
**Date:** 2026-05-22
**Deciders:** Owner (Márcio), engine working agent
**Supersedes:** the **iframe-embedding** alternative discussed in chat;
**refines:** ADR-003 (which already chose to port Wes wholesale, but didn't
spell out the agent/automation surface)

---

## Context

The studio reached a deadlock: the in-house engine has bug classes that
recur (gizmo, selection, store scene-model), and every attempt to "adapt"
a third-party engine into our React shell produced more inventions (the
`EditorCanvasV2` placeholder-cube fiasco) that destabilize the runtime.

The owner has stated two hard rules:

1. **No iframe / no engine-in-engine.** The 3D and 2D engines must be
   native modules of the same SPA, not embedded sandboxes. They share the
   same DOM, the same store, the same module graph. They "wear our skin"
   — our chrome around them, no second editor UI underneath.
2. **Vibe Coding is the only authoring workflow.** The owner doesn't write
   code by hand. Every change — features, bug fixes, content, refactors —
   ships through an AI agent (Claude Code, Codex, VS Code agents). The
   architecture must therefore expose a **stable, validated, transactional
   surface** that agents drive *directly*, not by editing JSON files
   blindly.

This is the kind of design where ambiguity is the killer: each agent will
pick a different interpretation if the protocol isn't pinned. So this ADR
fixes:

- Where the engines live (process, package, module graph).
- How the editor talks to them (no IPC; direct function calls).
- How agents talk to the editor (MCP / CLI / WebSocket / HTTP — and which
  is canonical for what).
- How a file change by an agent becomes visible in the editor without a
  page refresh.

### State at the time of this ADR

- `@pixlland/engine-core` (Phase 1 of ADR-002, committed 81b5e06c) —
  `.pixl` package format, asset source duality (URL or OPFS dir handle),
  content hashing. 8/8 vitest green. **Keep.**
- `@pixlland/engine-cli` (`pixl-engine`) — 9 commands (validate, outdated,
  migrate, new, import-level3d, export-level3d, pack, unpack, inspect).
  33/33 vitest green. **Keep — this is the agent's primary surface.**
- `@pixlland/three-runtime` (Phase A of ADR-003, committed eaed6f70) —
  ~2,900 lines ported 1:1 from `WesUnwin/three-game-engine` (MIT), 6/6
  vitest green, demo Node script loads 11,243 Harvest Rush nodes. **Keep
  Phase A.**
- `EditorCanvasV2.tsx` (Phase B MVP, committed cb4c5e25) —
  **REVERTED** by this ADR. The hand-rolled React adapter is the
  proven failure mode (placeholder cubes, manual `_init` bypass). It will
  be replaced by a proper module mount that follows Wes' own contract,
  not a React reinvention of it.
- `tools/vendor/three-game-engine/` and `tools/vendor/PhaserEditor2D-v3/`
  — vendored, gitignored, **study-only**. Not directly imported.

### What "no iframe" means in practice

- The 3D engine (`@pixlland/three-runtime`, our port of Wes) is a regular
  ESM module the studio `import`s. Its `Renderer` writes to a `<canvas>`
  element the studio owns.
- The 2D engine (`@pixlland/phaser-runtime`, to be ported — mirror of
  three-runtime but Phaser 4 + PhaserEditor2D-v3 patterns) is *also* a
  regular ESM module. Its game instance renders into a `<canvas>` element
  the studio owns.
- Both canvases live in the same React tree at the same address; only one
  is `display: block` at a time, depending on `scene.kind`.
- They never talk to each other. They only talk to the **scene store**.

### What "Vibe Coding native" means in practice

Every agent action follows the same loop:

```
Agent (Claude/Codex/VS Code)
  └─→ Engine Protocol Surface  (one of: MCP tool, CLI command, HTTP endpoint)
        └─→ Operation Library  (typed, validated, transactional)
              ├─→ writes to    project files on disk  (.pixlproject.json, Scenes/*, Assets/*)
              └─→ broadcasts   ProjectEvent to the editor over local WebSocket
                    └─→ Editor reloads the diff, re-renders, Inspector refreshes
```

The agent does NOT edit JSON by hand. The agent calls a typed function
("addObject", "setTransform", "createScript") and the operation library
does the write + validate + broadcast in one transaction.

---

## Decision

Adopt a **single-process, multi-module** architecture for the studio
itself, **plus a sibling local server process** that exposes the agent
protocol. Five-layer stack:

```
┌────────────────────────────────────────────────────────────────────────┐
│  LAYER 5 — AGENTS                                                       │
│  Claude Code · Codex · VS Code (Cursor) · future MCPs                   │
└──────┬───────────────────┬────────────────────┬─────────────────────────┘
       │ MCP stdio         │ HTTP/WS            │ CLI shell
┌──────▼───────────────────▼────────────────────▼─────────────────────────┐
│  LAYER 4 — PROTOCOL SURFACE                                             │
│  @pixlland/engine-mcp  ·  @pixlland/engine-api  ·  pixl-engine          │
│  (3 entry points → 1 operation library)                                  │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ typed function calls
┌─────────────────────────────────▼───────────────────────────────────────┐
│  LAYER 3 — OPERATION LIBRARY  (@pixlland/engine-ops)                    │
│  All writes: addObject, setTransform, createScene, packPixl, etc.       │
│  Every op: load doc → validate → mutate → re-validate → write → broadcast│
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ reads + writes
┌─────────────────────────────────▼───────────────────────────────────────┐
│  LAYER 2 — CANONICAL STATE  (the source of truth)                       │
│  Project folder on disk: .pixlproject.json, Scenes/*, Scripts/*, ...    │
│  + PIXL_PACKAGE_MANIFEST (sha256)                                        │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ file watcher + WS broadcast
┌─────────────────────────────────▼───────────────────────────────────────┐
│  LAYER 1 — STUDIO  (PixlPlayground Studio SPA, browser)                 │
│  Our chrome (Header / Toolbar / SceneGraph / Inspector / Content Browser│
│  / BottomPanel) wraps two CANVASES:                                      │
│    - @pixlland/three-runtime   (3D, mounted when scene.kind === '3d')   │
│    - @pixlland/phaser-runtime  (2D, mounted when scene.kind === '2d')   │
│  Both consume the canonical state via a Zustand store, never each other.│
└──────────────────────────────────────────────────────────────────────────┘
```

### Process topology

- **Browser process** runs the studio SPA (Vite dev or production build).
  Both runtime engines are ESM modules in the same bundle.
- **Local Node process** (`pixl-engine serve`) runs:
  - HTTP API (Express or Hono, port `8765` by default).
  - WebSocket broadcaster on the same port (`/ws`).
  - MCP stdio adapter that exposes the same Ops to Claude Code / Codex
    via the MCP protocol.
  - File watcher (chokidar) on the open project folder.
- **CLI invocations** are short-lived; they import the Ops library directly
  and exit. They emit a "wrote X" message to the broadcaster over a local
  Unix socket / named pipe so the live editor refreshes even when the
  change came from a CLI run outside the editor.

Single source of truth for *all* of them: the project folder on disk.
Nobody — not the browser, not the agent, not the CLI — keeps long-lived
authoritative state outside that folder.

### The Operation Library (`@pixlland/engine-ops`)

Pure TypeScript functions, no React, no Three, no Phaser. Every operation
has this shape:

```ts
export interface OpContext {
  projectDir: string;       // absolute path to the open project
  agent: string;             // 'cli' | 'mcp' | 'http' | 'editor'
  reason?: string;           // optional human-readable description
}

export interface OpResult {
  ok: boolean;
  changedFiles: string[];
  contentHash: string;       // post-op content hash of the project
  validationWarnings: string[];
  validationErrors: string[];
}

// Examples (final list ~25 ops):
project.create(name, kind: '2d' | '3d')
project.validate()
project.pack(outFile)
project.unpack(inFile, outDir)

scene.create(name, kind)
scene.delete(sceneId)
scene.setActive(sceneId)

object.add(sceneId, parentId | null, type, transform, components?)
object.update(sceneId, objectId, partial)
object.remove(sceneId, objectId)
object.reparent(sceneId, objectId, newParentId | null)
object.setTransform(sceneId, objectId, transform)
object.setComponent(sceneId, objectId, componentType, data)

asset.import(sourceFilePath, kind, targetSubpath?)
asset.remove(assetId)

script.write(scriptPath, contents)
script.read(scriptPath)
script.delete(scriptPath)

build.exportThree(outDir, options)
build.exportPhaser(outDir, options)
build.exportPixlland(outZip)
```

Every op runs the same pipeline:

1. Acquire a project-level write lock (single-writer at a time — no
   cross-agent corruption).
2. Read current project state from disk.
3. Validate against schema. Refuse if already invalid (point the agent at
   the failing path).
4. Apply the mutation in memory.
5. Re-validate. Refuse if the mutation produced an invalid state. The op
   never half-writes.
6. Compute new content hash.
7. Write to temp files → fsync → atomic rename.
8. Broadcast `ProjectEvent { type, changedFiles, contentHash, byAgent }`
   over the local WS.
9. Release lock.

### The three protocol surfaces

All three call the same `@pixlland/engine-ops` library underneath. They
differ only in transport.

#### A. `pixl-engine` CLI (already exists)

For agents that prefer shell invocation. Each command is one op.
Idempotent. Returns structured JSON to stdout on success (`--json` flag).

```
pixl-engine object add ./my-game/ scene-main --type=cube --x 0 --y 1 --z 0
pixl-engine script write ./my-game/Scripts/player.pixlscript.js "$(cat new-player.js)"
```

#### B. `@pixlland/engine-mcp` MCP server (new — Phase 3 below)

For Claude Code / Codex via stdio. Each op is one MCP tool with full
JSON-schema typing. The agent's tool-use loop reads the schema, picks the
right tool, fills the args, gets a structured response.

```jsonc
// Tool definition example
{
  "name": "object.add",
  "description": "Add a new object to a scene...",
  "input_schema": { /* JSON schema */ },
  "output_schema": { "$ref": "#/components/OpResult" }
}
```

#### C. `@pixlland/engine-api` HTTP + WS server (new — Phase 4 below)

For VS Code extensions, Cursor, and the studio SPA itself.

```
POST  http://localhost:8765/ops/object.add
GET   http://localhost:8765/project              (current document)
WS    ws://localhost:8765/ws                     (ProjectEvent stream)
```

The studio SPA opens the WS at boot. When the agent (via any of the three
surfaces) writes, the studio re-loads the diff in <50 ms — no page
refresh, no manual "open project again".

### Studio module structure (the "engines as native modules" part)

The studio's center viewport is a **single React component** that
internally decides which runtime to mount:

```tsx
// engine/apps/studio/src/components/canvas/Viewport.tsx (the only canvas component, post-cleanup)
function Viewport() {
  const sceneKind = useEditorStore((s) => s.activeSceneKind);
  return (
    <div className="viewport">
      <ThreeRuntimeMount   visible={sceneKind === '3d'} />
      <PhaserRuntimeMount  visible={sceneKind === '2d'} />
    </div>
  );
}
```

Each Mount component:

1. Owns a `<canvas>` element.
2. On mount, calls the engine's documented entry (Wes' `new Game(...)` for
   3D, Phaser 4's `new Phaser.Game(...)` for 2D) following the engine's
   own contract, NOT a hand-rolled adapter.
3. The engine reads the **same** project folder via `AssetStore` (the URL
   form when in dev server, the OPFS handle when project came from
   `.pixl`).
4. The engine's own selection/transform/gizmo system runs. The studio
   listens to selection events from the engine and updates the editor
   store. The studio does **not** invent a parallel gizmo or selection
   layer.
5. On unmount / `visible={false}`, the engine pauses but stays initialized
   (cheap to re-enter).

Two engines, two canvases, one chrome. **Engines never talk to each other.**
Cross-state lives in the project document.

### Concrete answer to "how does the agent inject code?"

For *gameplay scripts* (the things that run inside the player at runtime):

1. Agent calls `script.write(projectDir, 'Scripts/spawner.pixlscript.js', source)`.
2. Ops library validates the source is parseable ESM and matches the
   `pixlscript` API contract (must export `start`/`update`/`onCollision`).
3. Writes via atomic rename.
4. Broadcasts `ProjectEvent { type: 'script.changed', path: 'Scripts/spawner.pixlscript.js' }`.
5. Studio's `Scripts` panel hot-reloads the script. If a Play session is
   running, the runtime hot-swaps the script (or restarts the scene,
   configurable).

For *engine code* (the studio itself, the runtime packages):

- Agents edit source files in `engine/` exactly like a programmer would —
  same git workflow. Vite HMR picks the change up. CI gates regressions.
- No magical "hot-reload the editor while running" — that path is too
  fragile for agents. A page refresh is fine.

For *content* (assets, scene layout, prefabs):

- Agents call typed Ops. The Ops library is the only one that touches
  files. Hot-reload via WS broadcast is instant.

---

## Options Considered

### Option A — iframe per engine

The proposal from the earlier turn — each vendored engine in its own
`<iframe>`, postMessage bridge.

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Medium |
| Scalability | Limited |
| Team familiarity | Low |

**Pros:** Engines stay byte-identical to upstream. Zero risk of me
inventing adapters.
**Cons:** Owner explicitly rejected. iframe ≠ native integration. Cross-
frame postMessage is fragile for tight UI (selection lag, drag-drop
across frames). Two engine UIs underneath ours is exactly the "engine-in-
engine" the owner doesn't want.

### Option B — **Native module mount + sibling protocol server.** (Recommended)

| Dimension | Assessment |
|---|---|
| Complexity | Medium-high |
| Cost | 3 weeks layered (engine-ops → mcp → api → editor swap) |
| Scalability | High — agents, CLI, VS Code, future Cursor / Aider all hit one protocol |
| Team familiarity | High after Phase 3 lands |

**Pros:** Engines are real ESM modules — `import`, type-check, single
React tree, single store, single render loop per kind. Agents hit one
protocol with three transports (MCP / CLI / HTTP) backed by one Ops
library — no risk of three agent paths drifting. Studio receives changes
via WS broadcast → instant reflect, no refresh.
**Cons:** Requires the engines to expose enough of a programmatic API
that we don't reinvent it. Wes' `three-game-engine` already does
(documented `Game.loadScene`, `gameObject.setPosition`, etc). Phaser 4
also does (`Phaser.Scene` lifecycle, `add.sprite`, etc).

### Option C — One engine for both 2D and 3D (BabylonJS, PlayCanvas, etc.)

| Dimension | Assessment |
|---|---|
| Complexity | High — migration of every existing asset |
| Cost | High |
| Scalability | Highest single-engine |
| Team familiarity | Low |

**Pros:** No 2D/3D toggle needed.
**Cons:** Owner's existing investment is Three.js + Phaser. Babylon's
editor would mean abandoning both Wes' and PhaserEditor2D-v3's patterns.
Out of scope.

---

## Trade-off Analysis

Option B is the only one that satisfies all the owner's constraints
simultaneously:

- Engines as ESM modules (native, no iframe).
- Existing UI/UX on top (the studio chrome stays).
- Agent-first authoring (Ops library is the only writer).
- Three transports (MCP/CLI/HTTP) so every agent ecosystem (Claude Code,
  Codex, VS Code, future Cursor/Aider) has a first-class path.
- Vibe Coding is structurally enforced (the editor *can't* write outside
  the Ops library because every write goes through the lock + validate +
  broadcast pipeline; even a manual save in the editor calls
  `project.save()` from the Ops library).

The cost is the highest of the three options, but it's the only one that
won't need to be redesigned again in 6 months.

---

## Consequences

- **Becomes easier:**
  - Adding a new agent (a new MCP plug-in, a CLI script, a VS Code
    extension): zero new code, just consume the existing protocol.
  - Reverting an agent's mistake: it's a git revert. Every Op writes a
    commit-shaped diff (changedFiles + reason).
  - Multi-user collaboration: the WS broadcaster already exists; we add
    presence/cursors later for free.
  - Testing: the entire authoring surface is pure TS functions in
    `@pixlland/engine-ops`. Vitest covers it without spinning up a browser.

- **Becomes harder:**
  - The Studio can no longer mutate the project freely in memory — every
    edit goes through Ops. That's a discipline change but it's exactly
    what enables Vibe Coding.
  - The agent's first run on a project must include `pixl-engine serve`
    (or the editor must start it automatically). Document loudly.

- **What we'll need to revisit:**
  - When projects grow past ~500 MB, the full re-read on every Op gets
    slow. Switch to streaming diffs (CRDTs or jsondiff) at that point.
    Not now.
  - VR / multi-monitor authoring: the editor SPA assumes one viewport.
    Out of scope for ADR-004; ADR-005 if it ever becomes a priority.

---

## Revert decisions taken with this ADR

- **`EditorCanvasV2.tsx`** (committed cb4c5e25) — **delete**. It is the
  "invented adapter" failure mode. The next viewport implementation
  follows Wes' `MainArea.jsx` pattern adapted to TSX line-for-line, OR
  uses a vendored runtime entry point if Wes provides one.
- The `engine.versions.json` and runtime manifest stay; they belong to
  the canonical state layer.

---

## Action Items — Owner

1. [ ] Approve Option B.
2. [ ] Approve the protocol surface list (MCP + CLI + HTTP/WS) and
       confirm port `8765` is OK for local server (or pick another).
3. [ ] Authorize Phase 1 below (~4 days, additive, doesn't disrupt
       anything running) to begin.

---

## Phased Plan

### Phase 1 — `@pixlland/engine-ops` library (~4 days)

Pure TypeScript. No React, no Three, no Phaser. Reads/writes the project
folder via Node `fs.promises`. Same workspace pattern as
`@pixlland/engine-core` / `@pixlland/engine-cli`.

Deliverables:

- `engine/packages/ops/` workspace package.
- Op functions for every entry in the list above (25 ops).
- Per-op vitest with golden files (input doc → expected output doc).
- Project-level write lock implemented as an OS-level lockfile under
  `.pixl/lock`.
- ProjectEvent type definitions.

**Done means:** `pnpm --filter @pixlland/engine-ops test` runs the full
op matrix on a fixture project (a stripped Harvest Rush copy) and lands
green. Zero browser, zero engine deps.

### Phase 2 — `pixl-engine` CLI absorbs Ops (~1 day)

Existing CLI commands (`validate`, `outdated`, etc.) become thin wrappers
around the Ops library. New commands (`object.add`, `script.write`, etc.)
exposed under the same namespace.

```
pixl-engine ops list                       # discover commands
pixl-engine ops object.add ./game/ ...     # generic dispatch
pixl-engine validate ./game/               # legacy form, still works
```

**Done means:** every Op is callable from a single shell command. JSON
output is the default for machine consumers, pretty-printed for humans
via `--pretty`.

### Phase 3 — `@pixlland/engine-mcp` MCP server (~3 days)

New workspace package. Wraps Ops as MCP tools, one tool per Op. Schemas
generated from the Op TS types via `ts-json-schema-generator`.

The studio's `.mcp.json` and an installable npm package both point at this
server. Claude Code / Codex auto-introspect.

**Done means:** from a Claude Code session, an agent can
`object.add(...)` → editor (if open) immediately reflects the change via
WS broadcast.

### Phase 4 — `@pixlland/engine-api` HTTP + WS server (~3 days)

New workspace package. Fastify or Hono. Same Op surface as REST + a
single `/ws` endpoint for `ProjectEvent` broadcast. Starts automatically
when the studio Vite dev server starts (added to `pnpm engine:dev`).

The studio SPA opens the WS at boot. Existing Vite dev server stays as
the SPA host (port 8080). API listens on 8765.

**Done means:** kill the editor, run `pixl-engine object.add ...` from a
terminal, restart the editor — change is there. Or: keep editor open,
run the same command — change appears in <50 ms.

### Phase 5 — Studio adopts native engine mounts (~5 days)

Delete `EditorCanvasV2.tsx`. Replace `EditorCanvas.tsx`'s old hand-rolled
R3F+Drei tree with **two thin mount components**:

- `ThreeRuntimeMount.tsx` — boots `@pixlland/three-runtime` Game,
  connects its event emitter to the editor store, owns one `<canvas>`.
- `PhaserRuntimeMount.tsx` — boots `@pixlland/phaser-runtime` (Phase A.2D
  of ADR-003, mirror of three-runtime). Same shape.

Both mounts:

- Read the project document via the same `engine-ops/read` function the
  agents use.
- Listen to the editor store for selection/transform-mode changes.
- Listen to the WS broadcaster for ProjectEvents (so agent changes
  propagate without a refresh).
- Emit selection/transform changes back through `engine-ops/write`
  functions — the studio uses the same Ops the agents use.

The viewport chooses which mount to render based on the active scene's
`kind`. No iframe. No engine-in-engine. Same React tree, same DOM, same
Vite bundle.

**Done means:** Harvest Rush 3D opens, renders correctly, gizmo works,
inspector reflects edits, all object writes go through Ops, agent
sessions running in parallel see changes live.

### Phase 6 — `@pixlland/engine-sdk` (~2 days)

Thin TS package that wraps the three transports behind one client API:

```ts
import { PixlClient } from '@pixlland/engine-sdk';

const client = await PixlClient.connect({ projectDir: './my-game' });
// Auto-detects: pick MCP if available, else HTTP, else CLI subprocess.

await client.object.add({ sceneId: 'main', type: 'cube', transform: ... });
await client.script.write('Scripts/spawner.pixlscript.js', source);
```

This is what VS Code extensions, a future web dashboard, and the studio
itself import. Single import line covers MCP + HTTP + CLI fallback.

**Done means:** the studio SPA uses the SDK in-process (via HTTP). VS
Code extension stub uses the SDK over WS. CLI scripts use the SDK as a
shorthand for argparse.

---

## Anti-goals (explicitly NOT in this ADR)

- **No iframes**. Decided above. If we ever need to sandbox a script for
  safety, we use a Worker, not an iframe.
- **No remote server**. Everything runs locally. Cloud sync is ADR-002
  Phase 3 territory and stays opt-in.
- **No proprietary protocol on the wire**. MCP is the open standard;
  HTTP/WS uses JSON with the same shapes as the MCP tools; CLI emits the
  same JSON. Three transports, one schema.

---

## Risk register

1. **Ops library becomes a god module.** Mitigation: one file per op
   (~50 lines each), shared helpers in `_internal/`. Like Wes splits
   GameObject methods.
2. **WS broadcast loop (editor write → broadcast → editor reload).**
   Mitigation: every Op tags itself with `byAgent: string` (`'editor'`,
   `'cli'`, `'mcp-claude'`); the editor ignores broadcasts where
   `byAgent === 'editor'` and the contentHash already matches.
3. **Agents stomping each other.** Mitigation: project-level lock file.
   First writer wins; subsequent writers get a structured "busy" error
   with the holder's name. Agents are expected to retry.
4. **Migrating from the current broken `EditorCanvasV2`.** Mitigation:
   that whole file gets deleted as part of Phase 5. Phase A's
   `@pixlland/three-runtime` survives — it was the only honest 1:1 port
   so far.
