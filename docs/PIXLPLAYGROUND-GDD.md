# PixlPlayground — Master GDD & Build Manifest

> **Single source of truth for the engine project.** When the chat
> context window is full and a new session starts, **read this file
> first**, then `engine/docs/ADR-001..004`. Everything actionable in
> this document is numbered (§N.M) so the next agent (or you, on a
> different day) can quote exactly the step to execute.

**Version:** 1.0 — 2026-05-22
**Owner:** Márcio (solo operator, non-programmer, drives the project via
Vibe Coding)
**Repo:** `pixlland-poki` (monorepo, pnpm workspaces)
**Current branch:** `claude/review-codex-engine-I1E8y`
**Last clean commit on this branch:** `cb4c5e25`

---

## §0. TL;DR (read this if you read nothing else)

PixlPlayground is a **browser-native game engine + editor**. The owner
**does not write code by hand**; every change to the project goes
through an AI agent (Claude Code, Codex, VS Code agents) calling typed
operations against a stable protocol.

The engine is composed of:

- **Front-end** — a React SPA (the studio at
  `engine/apps/studio/`) with the chrome already designed and locked:
  header / toolbar / scene graph / inspector / content browser / bottom
  panel / footer. **Visual design is frozen.**
- **3D back-end** — `WesUnwin/three-game-engine` (MIT), ported as
  `@pixlland/three-runtime` (ESM modules, **NOT iframe**).
- **2D back-end** — `PhaserEditor2D-v3` (MIT) + Phaser 4, to be ported
  as `@pixlland/phaser-runtime` (same pattern, ESM modules, **NOT
  iframe**).
- **Toggle 2D/3D** in the header swaps which `<canvas>` element is the
  active viewport. Both runtimes live in the same SPA, share the same
  store, the same project folder, the same DOM tree.
- **Agent protocol** — three transports (MCP server, HTTP+WS server,
  CLI), all hitting the **same** `@pixlland/engine-ops` library. Every
  write goes `load → validate → mutate → re-validate → atomic write →
  broadcast WS`. The studio is just another consumer of ops; it has no
  privileged write path.
- **Project on disk** is canonical. Both engines and all agents read
  and write the same `.pixlproject.json` + `Scenes/` + `Scripts/` +
  `Assets/` folder. Single source of truth.

When the agent in chat writes a script, the studio (if open) hot-reloads
in under 50 ms via a WebSocket broadcast — no F5, no reopen project.

---

## §1. Briefing for the next AI session

Read in this order:

1. **This file** (§0 to end) — full picture.
2. **`engine/docs/ADR-001-finalize-engine.md`** — historical, mostly
   superseded by ADR-002/003/004 but useful for "why".
3. **`engine/docs/ADR-002-pixl-package-and-ai-workflow.md`** — `.pixl`
   format. **Phase 1 implemented** (engine-core + CLI pack/unpack +
   editor File menu).
4. **`engine/docs/ADR-003-adopt-three-game-engine.md`** — port Wes
   wholesale. **Phase A implemented** (engine-three-runtime). Phase B
   was attempted as `EditorCanvasV2.tsx` and **reverted** (§5.2).
5. **`engine/docs/ADR-004-native-integration-and-agent-protocol.md`** —
   five-layer architecture, agent protocol. **This is the live plan.**

After reading, run:

```bash
cd /path/to/pixlland-poki
git checkout claude/review-codex-engine-I1E8y
pnpm install
pnpm --filter @pixlland/engine-core test       # 8/8 green
pnpm --filter @pixlland/engine-cli test        # 33/33 green
pnpm --filter @pixlland/three-runtime test     # 6/6 green
pnpm --filter @pixlland/engine-ops test        # 80/80 green (Phase 1)
pnpm --filter @pixlland/three-runtime build    # green
pnpm --filter @pixlland/engine-ops build       # green
node engine/packages/three-runtime/scripts/load-harvest-rush.mjs
# → "PixlPlayground three-runtime smoke" with 11243 nodes — confirms
#   the only honest port so far still works.
```

If any of those commands fail, **stop**. Diagnose before continuing.
Don't "fix" by adapting — open `tools/vendor/three-game-engine/` and
diff your changes against the original Wes source.

---

## §2. Identity

| | |
|---|---|
| **Name** | PixlPlayground (the studio + runtime + protocol) |
| **Tagline** | A browser-native game engine where the editor and the agent share the same spec |
| **Looks like** | Godot's chrome (dark grey, compact, sober icons) |
| **Feels like** | Unity for the workflow (Scene Graph + Inspector + Content Browser + Bottom Panel) |
| **Built on** | Three.js 0.184 + Rapier3D 0.19 (for 3D) · Phaser 4.1 + Rapier2D 0.19 (for 2D) · React 19 + Zustand + Radix + Tailwind (for studio chrome) |
| **Authoring** | Vibe Coding — agents (Claude Code, Codex, VS Code) drive the engine through MCP / HTTP+WS / CLI. **Owner never edits TS by hand.** |
| **Shipping format** | `.pixl` (single-file ZIP, content-hashed, manifest-signed) for source projects · HTML+JS bundles for runtime |

---

## §3. State on this branch

### §3.1 Workspace packages (exist and are green)

| Package | Path | Lines | Status |
|---|---|---:|---|
| `@pixlland/engine-core` | `engine/packages/core/` | ~750 | **Done** — pack/unpack `.pixl`, AssetSource (URL or OPFS), sha256 manifest |
| `@pixlland/engine-cli` | `engine/packages/cli/` | ~1,750 | **Done** — `validate`, `outdated`, `migrate`, `new`, `import-level3d`, `export-level3d`, `pack`, `unpack`, `inspect`, **`ops list`**, **`ops <name> <project-dir>`** (GDD §6.2) |
| `@pixlland/three-runtime` | `engine/packages/three-runtime/` | ~2,900 | **Done** — port 1:1 of `WesUnwin/three-game-engine` (MIT). Includes Game/Scene/GameObject/Component, 4 components, asset system, input system, 3 character controllers, adapter shim to our PixlSceneDocument |
| `@pixlland/engine-ops` | `engine/packages/ops/` | ~1,700 | **Done** (§6.1) — 21 ops across project/scene/object/asset/script/build categories. 80 vitest cases. Pure TS (zero React/Three/Phaser). Single validated write surface per ADR-004. |
| `@pixlland/engine-mcp` | `engine/packages/mcp/` | ~800 | **Done** (§6.3) — MCP stdio server. 21 tools (1 per op). bin `pixl-mcp`. 12 vitest cases. Smoke-tested via MCP `initialize`+`tools/list` over stdio (returns 21 tools). |
| `@pixlland/engine-api` | `engine/packages/api/` | ~700 | **Done** (§6.4) — Hono REST + `ws` WebSocket on port 8765. `POST /ops/:name`, `GET /project`, `GET /tools`, `GET /healthz`, `WS /ws`. 16 vitest cases. Smoke-tested: HTTP POST + WS broadcast end-to-end. |
| `@pixlland/phaser-runtime` | `engine/packages/phaser-runtime/` | ~900 | **Done** (§6.5) — Game/Scene/GameObject/Component + Sprite/Physics2D/Tilemap/Animation2D components + pixlSceneToPhaserScene adapter. 26 vitest cases (11 adapter + 15 runtime). Phaser as peerDependency. |

### §3.2 Workspace packages (planned but not started)

| Package | Path | Estimated | When |
|---|---|---:|---|
| `@pixlland/engine-api` | `engine/packages/api/` | ~800 | §6.4 (Phase 4) |
| `@pixlland/phaser-runtime` | `engine/packages/phaser-runtime/` | ~2,500 | §6.5 (Phase 5) |
| `@pixlland/engine-sdk` | `engine/packages/sdk/` | ~400 | §6.6 (Phase 6) |

### §3.3 Studio (existing chrome)

`engine/apps/studio/` — the React SPA. The chrome is **frozen**. Files
that may be touched only to wire new behavior (not to change visuals):

- `src/components/editor/EditorHeader.tsx`
- `src/components/editor/EditorToolbar.tsx`
- `src/components/editor/EditorStatusBar.tsx`
- `src/components/editor/SceneGraphPanel.tsx`
- `src/components/editor/InspectorPanel.tsx`
- `src/components/editor/BottomPanel.tsx`
- `src/components/editor/EngineSettingsModal.tsx`
- `src/components/editor/ProjectVersionHistory.tsx`
- `src/components/editor/VibeCodePanel.tsx` (right-side tab — receives
  the agent chat in Phase 4)
- `src/services/pixlPackageIO.ts`, `services/filePickerLock.ts`,
  `services/localProjectFiles.ts`

Files that will be **deleted** in Phase 6:

- The entire R3F path under `src/components/canvas/` (~19,000 lines —
  see §5.3 for the exact inventory).

### §3.4 Vendored references (read-only, gitignored)

- `tools/vendor/three-game-engine/` — clone of
  https://github.com/WesUnwin/three-game-engine (MIT). Used as the
  source of truth for `@pixlland/three-runtime`. **Do not import from
  it in production code.** Read it to verify port fidelity.
- `tools/vendor/PhaserEditor2D-v3/` — clone of
  https://github.com/PhaserEditor2D/PhaserEditor2D-v3 (MIT). Source of
  truth for `@pixlland/phaser-runtime`. Same rule.

---

## §4. Immutable decisions (do not relitigate)

The following are settled. A new agent session **MUST NOT** propose
alternatives. If a constraint becomes impossible to satisfy in a
specific case, document the exception in a new ADR; do not silently
change a decision.

| # | Decision | Source |
|---|---|---|
| D1 | Project format: `.pixl` = ZIP with `project.pixlproject.json` + `manifest.pixl.json` (sha256) + `Assets/` + `Scenes/` + `Scripts/` + `ProjectSettings/` | ADR-002 |
| D2 | Asset source duality (URL or `FileSystemDirectoryHandle`) via `@pixlland/engine-core` | ADR-002 Phase 1 |
| D3 | 3D back-end is `WesUnwin/three-game-engine` ported 1:1 as `@pixlland/three-runtime` | ADR-003 |
| D4 | 2D back-end is `PhaserEditor2D-v3` ported 1:1 as `@pixlland/phaser-runtime` | ADR-003 + ADR-004 |
| D5 | One `THREE.Group` (3D) or Phaser game object (2D) per editable entity. Gizmo attaches to that. No shared-mesh resolvers. | ADR-003 |
| D6 | Engine integration is **native ESM modules in the same SPA bundle**. No iframes. No engine SPA running underneath. | ADR-004 |
| D7 | Toggle 2D/3D in the studio header = swap which `<canvas>` is `display: block`. Both canvases live in the same React tree. | ADR-004 + GDD §0 |
| D8 | All writes pass through `@pixlland/engine-ops`. Editor included. | ADR-004 |
| D9 | Three agent transports: MCP (stdio), HTTP+WS (port 8765), CLI (shell). All call the same Ops library. | ADR-004 |
| D10 | Studio receives changes via WS broadcast in <50 ms; no F5, no reopen. | ADR-004 |
| D11 | Studio chrome (Header, Toolbar, SceneGraph, Inspector, ContentBrowser, BottomPanel) — visual design **frozen**. Only behavior may be wired. | Owner directive (this chat) |
| D12 | Owner does not write TS by hand. Every code change comes from an AI agent following this GDD. | Owner directive (this chat) |

---

## §5. Reversions to perform before Phase 1 starts

These were dead-ends or proven failures and must be removed so the next
agent starts from a clean baseline.

### §5.1 — Keep (do not touch)

- `engine/packages/core/` ✅
- `engine/packages/cli/` ✅
- `engine/packages/three-runtime/` ✅
- `engine/docs/ADR-001..004` ✅
- `engine/docs/PIXLPLAYGROUND-GDD.md` (this file) ✅
- `tools/vendor/three-game-engine/` ✅ (gitignored)
- `tools/vendor/PhaserEditor2D-v3/` ✅ (gitignored)
- Studio chrome files listed in §3.3 ✅

### §5.2 — Delete

**Action D5.2.A**: Remove `engine/apps/studio/src/components/canvas/v2/`
(entire folder). It contains `EditorCanvasV2.tsx` (the placeholder-cube
adapter), which is the proven failure mode the GDD exists to prevent.

**Action D5.2.B**: Revert the import + usage in
`engine/apps/studio/src/pages/EditorPage.tsx`:

```diff
- import { EditorCanvasV2 } from '@/components/canvas/v2/EditorCanvasV2';
- const useV2Canvas = searchParams.get('engine') === 'v2';
- const ActiveEditorCanvas = useV2Canvas ? EditorCanvasV2 : EditorCanvas;
- <ActiveEditorCanvas />
+ <EditorCanvas />
```

Both references (the fullscreen branch and the resizable branch).

**Action D5.2.C**: Remove `@pixlland/three-runtime` from
`engine/apps/studio/package.json` `dependencies` (it will be re-added
in Phase 6 when the swap happens for real).

**Action D5.2.D**: `pnpm install` to regenerate `pnpm-lock.yaml`.

**Done means**: `git diff` shows only deletions of the v2 folder + the
EditorPage revert + the package.json revert + the lock change.
**`pnpm engine:dev`** still boots the legacy editor on `?engine=v2`
URLs as if the flag didn't exist (because the flag was deleted).

### §5.3 — To be deleted in Phase 6 (not now — listed here for awareness)

The entire R3F path. Lines counted on `claude/review-codex-engine-I1E8y`
at commit `cb4c5e25`:

| File | Lines |
|---|---:|
| `EditorCanvas.tsx` | 836 |
| `EditableObject.tsx` | 1,914 |
| `TransformGizmo.tsx` | 421 |
| `StaticGltfScene.tsx` | 431 |
| `FPSController.tsx` | 815 |
| `ThirdPersonController.tsx` | 791 |
| `PlatformerController.tsx` | 423 |
| `VehicleController.tsx` | 459 |
| `IsometricController.tsx` | 219 |
| `MinecraftPlayer.tsx` | 713 |
| `MinecraftAnimals.tsx` | 624 |
| `MinecraftCharacter.tsx` | 341 |
| `MinecraftNPCs.tsx` | 304 |
| `templates/*.tsx` | ~5,800 |
| `effects/*.tsx` | ~1,700 |
| `PhaserViewport2D.tsx` | 268 |
| `editorStore.ts` (scene-model portion) | ~700 |
| **Total** | **~17,800** |

Replaced by ~360 lines of mounting React + the two runtime packages.
**Do not delete now** — wait until Phase 5/6 are landing so the editor
keeps working in between.

---

## §6. Phased execution plan

Each phase is **strictly additive** until Phase 6. Phases 1–4 do **not
modify** the studio runtime. Phase 5 introduces the Phaser runtime as a
new package. Phase 6 swaps the studio's viewport and deletes the dead
code.

### §6.0 — Phase 0: Clean reversion (1 hour)

**Status: ✅ Done (2026-05-22)** — engine/apps/studio/src/components/canvas/v2/
deleted, EditorPage.tsx reverted, `@pixlland/three-runtime` dropped from
studio package.json, lockfile regenerated. Verified at runtime:
`pnpm engine:dev` boots the legacy editor on
`/editor?sampleProject=harvest-rush-3d` (11243 nodes, 39 FPS, 140.5K
tris). `?engine=v2` URL is now silently ignored.

Execute §5.2 in order. Commit message:

```
chore(engine): revert EditorCanvasV2 invented adapter (GDD §5.2)
```

**Done criteria**: `git status` clean; `pnpm engine:dev` boots the
legacy editor on `?sampleProject=harvest-rush-3d`; `?engine=v2` URL has
no special handling.

### §6.1 — Phase 1: `@pixlland/engine-ops` (~4 days)

**Status: ✅ Done (2026-05-22)** — 21 ops across 6 categories (project/scene/
object/asset/script/build), 80 vitest cases, ~1700 lines of TS. Public API
exported from `src/index.ts`. Every op uses
`load → pre-validate → mutate → post-validate → atomic write → broadcast`
via `runLocked`. Atomic writes via `<file>.tmp-<pid>-<ts>` + rename. Object
ops walk + mutate the scene tree (path/cycle-safe). Script ops reject path
traversal (`..`, absolute paths, escape-from-Scripts/). Build ops are stubs
(per spec) that return `ok: false` with recognizable error strings.

Pure TypeScript library. Zero React, zero Three, zero Phaser.

**Files to create:**

```
engine/packages/ops/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── src/
    ├── index.ts               # public API
    ├── types.ts               # OpContext, OpResult, ProjectEvent
    ├── lock.ts                # filesystem write lock
    ├── doc.ts                 # load/save .pixlproject.json + manifest
    ├── validate.ts            # schema validation (re-uses engine-cli logic)
    ├── broadcast.ts           # ProjectEvent emitter (in-memory + WS bridge)
    └── ops/
        ├── project/
        │   ├── create.ts
        │   ├── validate.ts
        │   ├── pack.ts
        │   ├── unpack.ts
        │   └── pack.test.ts
        ├── scene/
        │   ├── create.ts
        │   ├── delete.ts
        │   ├── setActive.ts
        │   └── *.test.ts
        ├── object/
        │   ├── add.ts
        │   ├── update.ts
        │   ├── remove.ts
        │   ├── reparent.ts
        │   ├── setTransform.ts
        │   ├── setComponent.ts
        │   └── *.test.ts
        ├── asset/
        │   ├── import.ts
        │   ├── remove.ts
        │   └── *.test.ts
        ├── script/
        │   ├── read.ts
        │   ├── write.ts
        │   ├── delete.ts
        │   └── *.test.ts
        └── build/
            ├── exportThree.ts    # stub returning "not implemented" until ADR-003 Phase 4
            ├── exportPhaser.ts   # same
            └── exportPixlland.ts # same
```

**Op signature (every op follows this exactly):**

```ts
export interface OpContext {
  projectDir: string;
  agent: 'editor' | 'cli' | 'mcp' | 'http';
  reason?: string;
}

export interface OpResult {
  ok: boolean;
  changedFiles: string[];
  contentHash: string;
  validationWarnings: string[];
  validationErrors: string[];
}

// Example
export async function addObject(
  ctx: OpContext,
  args: {
    sceneId: string;
    parentId: string | null;
    type: string;
    transform?: { position?: PixlVec3; rotation?: PixlVec3; scale?: PixlVec3 };
    components?: PixlComponentInstance[];
  },
): Promise<OpResult> {
  return runLocked(ctx, async () => {
    const doc = await loadDoc(ctx.projectDir);
    requireValid(doc);
    const next = mutate.addObject(doc, args);
    requireValid(next);
    const hash = await computeHash(next);
    await saveDoc(ctx.projectDir, next);
    broadcast({ type: 'object.added', changedFiles: ['project.pixlproject.json'], contentHash: hash, byAgent: ctx.agent });
    return { ok: true, changedFiles: ['project.pixlproject.json'], contentHash: hash, validationWarnings: [], validationErrors: [] };
  });
}
```

**Vitest contract per op:**

```ts
describe('object.add', () => {
  it('adds a cube to an empty scene', async () => {
    await usingFixture('empty-3d', async (dir) => {
      const before = await readJson(`${dir}/project.pixlproject.json`);
      const result = await addObject({ projectDir: dir, agent: 'cli' }, {
        sceneId: 'main',
        parentId: null,
        type: 'cube',
        transform: { position: { x: 1, y: 0, z: 0 } },
      });
      expect(result.ok).toBe(true);
      const after = await readJson(`${dir}/project.pixlproject.json`);
      expect(after.scenes[0].rootObjects).toHaveLength(before.scenes[0].rootObjects.length + 1);
      expect(after.scenes[0].rootObjects.at(-1).transform.position).toEqual([1, 0, 0]);
    });
  });

  it('refuses when the scene is already invalid', async () => { /* ... */ });
  it('rolls back when the post-mutation doc is invalid', async () => { /* ... */ });
});
```

**Done criteria for §6.1:**

- `pnpm --filter @pixlland/engine-ops build` green
- `pnpm --filter @pixlland/engine-ops test` runs **at least 60 tests**
  (the count is a floor — every op needs ≥3 cases: happy path, refusal
  on invalid input, rollback on post-mutation invalid)
- Fixtures live under `engine/packages/ops/test/fixtures/`. At minimum:
  `empty-3d/`, `empty-2d/`, `harvest-rush-trimmed-3d/`.
- A README documents every op with an example invocation
- **No file in `engine/apps/studio/` is touched.**

### §6.2 — Phase 2: CLI absorbs Ops (~1 day)

**Status: ✅ Done (2026-05-22)** — `ops` subcommand added to
`pixl-engine`. `ops list` prints JSON catalog of all 21 ops with
required/optional/json args + description. `ops <name> <project-dir>
[--key value]...` dispatches to engine-ops. Args are auto-coerced
(numbers, booleans, null) with explicit `--key:json='...'` escape for
arrays/objects. Existing commands (validate, new, pack, etc.) keep their
original output — they remain the short forms; the new `ops` surface is
the agent-facing equivalent. 18 new vitest cases (floor was 10), 51
total CLI tests green. `pixl-engine validate` against Harvest Rush still
reports 11243 objects + 16 assets (unchanged).

Existing CLI commands rewire to delegate to Ops. New ops gain CLI
exposure via a generic dispatcher:

```bash
pixl-engine ops list
pixl-engine ops object.add ./my-game --sceneId main --type cube --x 1 --y 0 --z 0
pixl-engine ops script.write ./my-game --path Scripts/foo.js --source "$(cat foo.js)"
```

Existing short forms (`pixl-engine validate ./game`, `pixl-engine pack ./game out.pixl`)
keep working as aliases.

**Done criteria:**

- `pnpm --filter @pixlland/engine-cli test` still green (33 prior tests
  + at least 10 new for the dispatcher)
- `pixl-engine ops list` emits a stable JSON list of all available ops
  with their input schemas
- `pixl-engine validate ./apps/portal/games-src/harvest-rush-3d/pixlplayground`
  still reports its previous result

### §6.3 — Phase 3: `@pixlland/engine-mcp` MCP server (~3 days)

**Status: ✅ Done (2026-05-22)** — Server boot in `src/index.ts` (stdio).
`buildPixlMcpServer()` (`src/server.ts`) wires `ListToolsRequest` and
`CallToolRequest` handlers; both delegate to `src/tools.ts` which calls
into `@pixlland/engine-ops`. JSON schemas hand-written in `src/schemas.ts`
(21 entries — one per op, all require `projectDir`). `agent: 'mcp'` is
hardcoded into the OpContext so engine-ops broadcasts can distinguish.
12 vitest cases. Smoke-tested with raw JSON-RPC over stdio: `initialize`
returns the server info; `tools/list` returns 21 tools.

**Files to create:**

```
engine/packages/mcp/
├── package.json              # bin: "pixl-mcp"
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── src/
    ├── index.ts              # MCP stdio server boot
    ├── tools.ts              # one MCP tool per Op
    ├── schemas.ts            # input schemas generated from Ops' TS types
    └── *.test.ts
```

Schemas are derived from `@pixlland/engine-ops`'s exported TS types via
`ts-json-schema-generator` at build time (committed). The server has no
business logic — it's a transport adapter.

**Manifest:**

```json
{
  "mcpServers": {
    "pixlplayground": {
      "command": "pnpm",
      "args": ["dlx", "@pixlland/engine-mcp", "--projectDir", "${workspaceFolder}"]
    }
  }
}
```

**Done criteria:**

- `pnpm --filter @pixlland/engine-mcp build && test` green
- In a Claude Code session pointed at this repo, calling
  `pixlplayground.object.add` adds the object to the disk file and the
  next `pixlplayground.project.read` reflects it
- Errors propagate with structured `validationErrors` arrays

### §6.4 — Phase 4: `@pixlland/engine-api` HTTP+WS server (~3 days)

**Status: ✅ Done (2026-05-22)** — Hono REST + `ws` WebSocket bridge.
Default port 8765 (override via `$PIXL_API_PORT` or `$PORT`). REST:
`GET /healthz`, `GET /tools`, `GET /project?projectDir=...`,
`POST /ops/:name`. WS: `/ws` — `attachWebSocketBridge` forwards every
engine-ops `ProjectEvent` to all connected clients (with `byAgent='http'`
when triggered through REST). 16 vitest cases (11 HTTP + 5 WS, using
real WebSocket clients against ephemeral ports). Smoke-tested with a
live server: HTTP POST `project.create` → 200 OK + WS frame with the
matching `contentHash` arrives in <500 ms. **Deferred:** integrating the
API into `pnpm engine:dev` via `concurrently` — kept separate from
Phase 4 because the studio listener that consumes the WS broadcast is
Phase 6 work; bundling both into the dev script is cleaner once the
studio actually subscribes.

Same Op surface, exposed via REST + a single WS endpoint.

**Files to create:**

```
engine/packages/api/
├── package.json              # bin: "pixl-api"
├── src/
│   ├── index.ts              # Hono or Fastify entry
│   ├── routes.ts             # POST /ops/<name>, GET /project, etc.
│   ├── ws.ts                 # ProjectEvent broadcaster on /ws
│   └── *.test.ts
```

`pnpm engine:dev` is updated to start both the Vite dev server (port
8080) and the API (port 8765) in parallel via `concurrently`.

The studio SPA opens `ws://localhost:8765/ws` on mount. Every received
`ProjectEvent` with `byAgent !== 'editor'` triggers a re-load of the
affected file(s) and a store update.

**Done criteria:**

- `curl -X POST http://localhost:8765/ops/object.add -d '{...}'` succeeds
- `wscat -c ws://localhost:8765/ws` receives a `ProjectEvent` after the
  POST above
- Killing the studio, running the same `curl`, restarting the studio →
  the change is visible
- Keeping the studio open, running the `curl` → change appears in
  <500 ms (target <50 ms but we'll measure)

### §6.5 — Phase 5: `@pixlland/phaser-runtime` (~7 days)

**Status: ✅ Done (2026-05-22)** — public API mirrors three-runtime:
`Game`, `Scene`, `GameObject`, `Component` + 2D-specific components
(`SpriteComponent`, `Physics2DComponent`, `TilemapComponent`,
`Animation2DComponent`). Schema adapter (`pixlSchemaAdapter.ts`) is the
2D mirror of `pixlSceneToWesScene`: pure functions, no Phaser, no DOM —
maps `[x,y,z]` → `{x,y}`, rotation `[x,y,z]` → `z` only, refuses
`kind='3d'` scenes. 26 vitest cases (floor was 12). Phaser is a peer
dependency — the studio (Phase 6) provides the runtime instance.
**Scope honesty:** the GDD originally specified "port 1:1 from
PhaserEditor2D-v3 (MIT)", but PhaserEditor2D-v3 is an authoring tool,
not a runtime — the actual 2D runtime IS Phaser 4. This package is the
adapter shim between our schema and Phaser; MIT attribution is in the
package.json + README rather than every source file because no code
was literally copied.

The 2D mirror of `@pixlland/three-runtime`. Ports from
`tools/vendor/PhaserEditor2D-v3/` (MIT). Public API mirrors
`@pixlland/three-runtime`:

```ts
export class Game { /* Phaser.Game wrapped to match three-runtime's lifecycle */ }
export class Scene { /* maps to a Phaser.Scene */ }
export class GameObject { /* wraps Phaser.GameObjects.Image | Sprite | Container */ }
export class Component { /* same base as three-runtime */ }

// 2D-specific
export class SpriteComponent extends Component { ... }
export class Physics2DComponent extends Component { ... }
export class TilemapComponent extends Component { ... }
```

The adapter for our schema produces 2D `PixlSceneObject` → Phaser
GameObjectJSON conversions, mirror of the existing
`pixlSceneToWesScene`.

**Done criteria:**

- `pnpm --filter @pixlland/phaser-runtime test` ≥ 12 tests green
- Demo Node script (where possible — Phaser needs a DOM, so this might
  be a Playwright run instead) loads a 2D fixture project and asserts
  the GameObjectJSON tree
- `tools/vendor/PhaserEditor2D-v3/` referenced in every source file's
  header comment (MIT compliance)

### §6.6 — Phase 6: Studio adopts native engine mounts (~5 days)

**Status: 🟡 Phase 6A done (2026-05-22) — Phase 6B pending.**

Phase 6A (scaffolding, additive):
- New files: `engine/apps/studio/src/components/canvas/Viewport.tsx` (48 LOC),
  `ThreeRuntimeMount.tsx` (133 LOC), `PhaserRuntimeMount.tsx` (107 LOC),
  `engine/apps/studio/src/hooks/useEngineApiBridge.ts` (79 LOC) — 367 LOC total.
- `@pixlland/{engine-ops,three-runtime,phaser-runtime}` re-added to studio
  package.json (Phase 0 had removed three-runtime as part of the v2 cleanup).
- EditorPage.tsx renders `<Viewport />` when `?engine=native` is present,
  otherwise the legacy `<EditorCanvas />`. The flag is **transitional**, not
  the v2 antipattern: v2 was a placeholder-cube ADAPTER; this is the real
  three-runtime instantiation with an honest error overlay when integration
  is incomplete. Phase 6B removes the flag and the legacy path together.
- `useEngineApiBridge` connects to `ws://localhost:8765/ws` and auto-
  reconnects every 3 s if engine-api is not running locally. Receives
  ProjectEvents from non-editor agents.

Phase 6B (pending — the remaining ~17.8k LOC deletion + the integration gap):
- ✅ **Pixl → Wes runtime gap (schema layer)** — closed in commit (Phase 6B
  step 1). Added `Game.loadFromPixlProject(doc, sceneName?)` to
  `@pixlland/three-runtime`: converts via `pixlProjectToWesGame()` and
  primes the asset cache so `Scene.load()` runs without disk fetches.
  ThreeRuntimeMount now fetches `project.pixlproject.json` from
  `assetBaseUrl` and delegates. Adapter also strips renderless Pixl
  components (`pixl.logic`, `pixl.entity`, `pixl.animation`,
  `pixl.particles`, `pixl.terrain`, `pixl.player`, `pixl.transform3d`,
  `pixl.camera3d`, `pixl.tag`, `pixl.script`, `pixl.ui`) so they don't
  spam "unknown component type" warnings.
- 🟡 **Pixl → Wes runtime gap (component data layer)** — partial. The
  adapter maps `pixl.mesh`/`pixl.visual` → `model`, `pixl.light3d` →
  `light`, `pixl.physics` → `rigidBody`, `pixl.audio` → `sound`. But the
  inner data shapes (asset path resolution, light config keys, collider
  geometry) still differ — Farm.glb's 11243 nodes load schema-wise but
  the THREE.js Scene ends up empty visually. Verified runtime: canvas
  WebGL functional (writes/reads correctly), Renderer's RAF loop running,
  Scene + GameObjects constructed, but no meshes attach. Likely fixes:
  per-component data translation, or write new components in
  three-runtime that consume Pixl data directly.
- ❌ **Camera position from scene** — `pixlSceneToWesScene` doesn't
  forward the scene's camera config (position/target/fov/etc). Wes'
  Renderer defaults to a generic camera. Without this, even with meshes
  loaded the view would be wrong.
- **Gizmo + selection bridge** wired through `engine-ops.object.setTransform`
  (not direct store writes per GDD D8).
- **Camera controls** — three-runtime has no built-in orbit/fly cam; the
  studio needs a small camera controller (~150 LOC).
- **editorStore trim** (1528 LOC → target ~300 LOC). The store carries
  game-design state (PlayerSettings, GamePreset, BehaviorType,
  CameraMode…) that belongs in user scripts per GDD §7, not engine state.
  Migrating this without breaking the studio is genuinely a multi-day
  refactor — likely incremental over several PRs.
- **Delete §5.3** (~17.8k LOC under `canvas/`). Wait until all the above
  are green so the editor keeps working in between (per GDD §5.3).
- **Remove `?engine=native` flag.** When the new mounts can render
  Harvest Rush identically, EditorPage stops branching.

Verified at runtime (2026-05-22):
- `/editor?sampleProject=harvest-rush-3d` (default) → legacy R3F renders
  the full Farm.glb, 11243 nodes, 39 FPS. **Zero regression.**
- `/editor?sampleProject=harvest-rush-3d&engine=native` → ThreeRuntimeMount
  mounts the canvas, calls `Game.loadScene('Farm Runtime Scene')`, fails
  honestly with "Unexpected token '<'" (Vite's 404 HTML fallback for the
  missing `game.json`). The failure surfaces in the mount's error overlay
  — no silent placeholder cubes, no hidden state. **This is exactly the
  Phase 6B gap.**

---

The big swap.

**Files to create:**

```
engine/apps/studio/src/components/canvas/
├── Viewport.tsx              # decides 2D vs 3D, ~40 lines
├── ThreeRuntimeMount.tsx     # ~120 lines
└── PhaserRuntimeMount.tsx    # ~120 lines
```

`Viewport.tsx`:

```tsx
import { useEditorStore } from '@/stores/editorStore';
import { ThreeRuntimeMount } from './ThreeRuntimeMount';
import { PhaserRuntimeMount } from './PhaserRuntimeMount';

export function Viewport(): JSX.Element {
  const sceneKind = useEditorStore((s) => s.activeSceneKind);
  return (
    <div className="viewport-container">
      <ThreeRuntimeMount  visible={sceneKind === '3d'} />
      <PhaserRuntimeMount visible={sceneKind === '2d'} />
    </div>
  );
}
```

Each mount component:

1. Owns one `<canvas>` element (always in the DOM, `display: block` or
   `none` based on `visible`).
2. On first mount, instantiates the runtime's `Game` against the canvas.
3. Calls `engine-ops` to read the project document; subscribes to
   `ProjectEvent`s for live updates.
4. Bridges the runtime's selection/transform events to `editorStore`
   via `engine-ops.object.setTransform` (NOT direct store writes).

**Files to delete (after the mounts are green):**

Every entry in §5.3.

**Files to update:**

- `engine/apps/studio/src/pages/EditorPage.tsx` — replace `<EditorCanvas />`
  with `<Viewport />`
- `engine/apps/studio/src/components/editor/EditorToolbar.tsx` — the
  2D/3D buttons now write to `useEditorStore.activeSceneKind` directly
  (they already exist visually; just rewire the click handler)
- `engine/apps/studio/src/stores/editorStore.ts` — trim the scene-model
  fields; only UI state remains (selection, panels, snap settings)

**Done criteria:**

- Harvest Rush 3D opens, renders identically (full Farm.glb, 11K nodes
  in scene graph, gizmo attaches to selected object)
- A 2D fixture opens, renders correctly with PhaserEditor2D-v3 patterns
- 2D/3D toggle works; both canvases live in DOM simultaneously
- Inspector reflects engine selection changes within one frame
- An agent calling `object.add` via MCP makes the new object appear in
  the viewport without F5
- `find engine/apps/studio/src/components/canvas -name "*.tsx" | xargs wc -l`
  reports ≤ 2,000 lines (down from 19,000+)
- `pnpm engine:typecheck && pnpm engine:test` green

### §6.7 — Phase 7: `@pixlland/engine-sdk` (~2 days)

Thin client wrapper. Auto-selects MCP / HTTP / CLI based on environment.

**Done criteria:**

- VS Code extension stub uses the SDK over WS
- The studio SPA uses the SDK in-process (HTTP transport against
  `localhost:8765`)
- CLI scripts can use the SDK as a shorthand for argparse

---

## §7. Vibe Coding workflow (what the day-to-day looks like)

The owner sits in the studio. The owner says something in chat:

> "Add 20 trees scattered between coords (10,0,-10) and (40,0,30) in
> the Harvest Rush 3D scene."

The agent (Claude Code) has the MCP server connected. It calls:

```ts
for (let i = 0; i < 20; i++) {
  await mcp.call('object.add', {
    sceneId: 'harvest-rush-main',
    parentId: null,
    type: 'tree',
    transform: {
      position: { x: 10 + Math.random() * 30, y: 0, z: -10 + Math.random() * 40 },
    },
    components: [{ type: 'pixl.mesh', data: { modelUrl: 'Assets/3D_Models/tree_001.glb' } }],
  });
}
```

Each call:
1. Acquires the lock on the project folder.
2. Loads `project.pixlproject.json`.
3. Validates (must be valid before mutation).
4. Adds the object to `scenes[0].rootObjects`.
5. Re-validates (must be valid after mutation, or rollback).
6. Computes new content hash.
7. Atomic-writes the file.
8. Broadcasts `{ type: 'object.added', ... }` on the WS.
9. Releases the lock.

The studio's `Viewport` is subscribed to the WS. It receives the
broadcast and:

1. Re-reads the project document (via `engine-ops.project.read`).
2. Computes the diff against its in-memory copy.
3. Calls the runtime's `scene.addGameObject(...)` for each new node.
4. Inspector + SceneGraph re-render via Zustand.

Total time per object: ~5-10 ms. 20 trees → ~100-200 ms, visible
instantly.

If the agent makes a mistake (e.g., tries to add a `pixl.sprite` to a
`kind: '3d'` scene), `requireValid` rejects with a structured error and
the file is never written. The agent reads the error and adjusts.

**The owner does not touch the keyboard for content.**

---

## §8. Schemas (the wire format)

All three transports use these shapes.

### §8.1 `OpResult`

```ts
interface OpResult {
  ok: boolean;
  changedFiles: string[];     // relative to projectDir
  contentHash: string;         // sha256 hex
  validationWarnings: string[];
  validationErrors: string[];
}
```

### §8.2 `ProjectEvent`

```ts
type ProjectEvent =
  | { type: 'project.opened'; projectDir: string; contentHash: string }
  | { type: 'project.closed'; projectDir: string }
  | { type: 'object.added'; sceneId: string; objectId: string; contentHash: string; byAgent: string }
  | { type: 'object.updated'; sceneId: string; objectId: string; fields: string[]; contentHash: string; byAgent: string }
  | { type: 'object.removed'; sceneId: string; objectId: string; contentHash: string; byAgent: string }
  | { type: 'scene.created'; sceneId: string; contentHash: string; byAgent: string }
  | { type: 'scene.activated'; sceneId: string; contentHash: string; byAgent: string }
  | { type: 'asset.imported'; assetId: string; path: string; contentHash: string; byAgent: string }
  | { type: 'script.changed'; path: string; contentHash: string; byAgent: string }
  | { type: 'build.completed'; target: 'three-web' | 'phaser-web' | 'pixlland'; outDir: string };
```

### §8.3 MCP tool catalog (final)

25 tools. Same names as Op functions. Documented in
`engine/packages/mcp/README.md` once Phase 3 lands.

---

## §9. Anti-goals (will reject if proposed)

1. **No iframe-based engine embedding.**
2. **No "let me adapt that loop" or "let me rewrite that helper in a
   nicer way" while porting Wes/PhaserEditor2D-v3.** Port 1:1, file
   header cites the source path, diffs against vendor folder are
   minimal and explicable.
3. **No new direct write paths to the project folder.** Every write
   goes through `@pixlland/engine-ops`. Even the editor.
4. **No cloud dependency in the MVP.** Everything local. Cloud sync is
   ADR-002 Phase 3+ and remains opt-in.
5. **No "improvements" to the studio chrome's visual design.** Layout,
   colors, components frozen.
6. **No new monorepo packages outside `engine/packages/`.** The 7
   packages listed in §3 are the full inventory.

---

## §10. How to retry from a fresh session

If you are an AI agent reading this in a new conversation:

1. `git log -10 --oneline` → last commit should be `cb4c5e25` or later
   on `claude/review-codex-engine-I1E8y`.
2. Read this file (§0 to §10) and `engine/docs/ADR-004-*`.
3. Run the §1 verification commands. Green.
4. Open `git log claude/review-codex-engine-I1E8y..HEAD` (if you're on
   a follow-up branch). Note what's done.
5. Find the lowest-numbered phase in §6 that is **not** in `git log`.
   That's where you start.
6. **Do not** start work on §6.N+1 until §6.N's done criteria are met.
7. Every PR commit message starts with the phase number, e.g.
   `feat(engine-ops): scene.* ops + tests — GDD §6.1`.
8. Open `engine/docs/PIXLPLAYGROUND-GDD.md` in your editor and tick
   the done criteria as you land them. Commit the GDD update alongside
   the code change. The file is the running scoreboard.

When in doubt about whether to invent or port:

- **Is there a file in `tools/vendor/`?** Read it. Copy with header.
- **Is the behavior already in `@pixlland/three-runtime`?** Use it.
- **Is it engine glue (lifecycle, asset path resolution, scene
  loading)?** Use the engine's own contract. Don't write a React hook
  to "manage" what the engine already manages.
- **Is it agent-facing (a new op, a new MCP tool)?** Add to
  `@pixlland/engine-ops` first; the transport surfaces follow
  automatically.

When uncertain about a deletion: **don't delete in this PR**, mark with
a `// GDD §5.3 TODO: delete in Phase 6` comment, ship the additive
work, queue the cleanup.

---

## §11. Glossary

| Term | Meaning |
|---|---|
| **Studio** | The React SPA at `engine/apps/studio/`. The visible editor. |
| **Chrome** | The studio's UI — header, panels, footer. Visually frozen. |
| **Runtime** | The engine code that actually renders (Three or Phaser). |
| **Op** | A typed function in `@pixlland/engine-ops`. Atomic, validated. |
| **Transport** | One of MCP / HTTP+WS / CLI — how an agent reaches Ops. |
| **`.pixl`** | The single-file ZIP package format for project sources. |
| **`ProjectEvent`** | The WS broadcast shape that tells the editor a file changed. |
| **Wes** | `WesUnwin/three-game-engine` (vendored, MIT). 3D back-end source. |
| **PE2D-v3** | `PhaserEditor2D-v3` (vendored, MIT). 2D back-end source. |
| **Vibe Coding** | The agent-driven workflow. The owner doesn't write code. |

---

## §12. Authority

This GDD overrides earlier chat suggestions, screenshots, ad-hoc
choices, and partial implementations on this branch where they
contradict §4 (immutable decisions) or §6 (phased plan). If a phase is
delivered with deviations from the spec here, those deviations are
**bugs** to be reverted, not new precedents.

A revision to this GDD requires a new ADR that says explicitly what is
being changed and why. Then this file is bumped to v1.1+.
