# ADR-002: `.pixl` Package, Bundled Build, and AI Co-Authoring Workflow

**Status:** Proposed
**Date:** 2026-05-22
**Deciders:** Owner (Márcio), engine working agent
**Branch context:** `claude/review-codex-engine-I1E8y` (merged with `origin/main` today)

---

## Context

The engine review branch already gives us a real working engine — visually confirmed today opening Harvest Rush 3D:

- 11,243 objects in the scene tree at 60 FPS, full Inspector (Transform/Visual/Physics/Tags/Entity/Audio/Animation).
- Header menus File / Edit / Scene / Tools / **Build** / Window / Help with **Play** in the top right.
- `@pixlland/engine-cli` (`pixl-engine`) ships **6 commands** today: `validate`, `outdated`, `migrate`, `new --kind 2d|3d`, `import-level3d`, `export-level3d` — round-trip identity proven on the real Harvest Rush level3d.
- `engine.versions.json` is the single source of truth for pinned versions (Three 0.184 / Phaser 4.1 / React 19.2 / Rapier 0.19.3).
- Play in Editor exists: `engine/apps/studio/src/engine/runtime/runtimePreview.ts` resolves `game.source.runtimeFile` + a project root URL, then mounts a fresh `<iframe srcDoc>` (see `RuntimeGameFrame.tsx`) — works while the dev server is up, but it points at loose source files, not a packaged build.

The user's ask, in plain terms:

> "I want a `.pixl` file that contains the game (Three.js if 3D, Phaser 4 if 2D). I save it locally, I open it locally. I work on it in the engine together with an AI (via MCP, CLI, anything), the AI writes the code, I just polish visuals in the engine."

So the gap is in **packaging + portability + AI surface**, not in the editor itself:

1. **No `.pixl` container.** Today the project lives as a loose folder with a `.pixlproject.json` plus sibling `Assets/Scenes/Scripts/…`. There is no single file you can move between machines.
2. **No bundled build.** `Play` runs straight off the dev server. `pixl-engine export-three` / `export-phaser` / `export-pixlland` are mentioned in `engine/PLAN.md` (item 5) but not implemented.
3. **No MCP server.** Item 8 of `PLAN.md`. The CLI is what an agent uses today.
4. **No Import/Export menu.** The header `Build` and `File` menus need wiring (the file IO infra in `localProjectFiles.ts` already exists for the loose folder case).

The user explicitly does **not** want the engine team typing implementations by hand inside the engine — the engine should *generate* a portable build like Godot exports `.pck`, Unity exports a project package, Unreal exports a `.pak`.

---

## Decision

Define the `.pixl` format and bolt three things onto the existing infrastructure — without rewriting it:

1. **`.pixl` = ZIP container** (Deflate, no encryption) with a fixed layout, content-hashed.
2. **Bundle compilation** via the existing `@pixlland/engine-cli` (`pack`, `unpack`, `export-three`, `export-phaser`, `export-pixlland`). Reuses esbuild from the workspace.
3. **Two front-doors for AI co-authoring:** the same CLI, plus a thin **MCP server** that exposes the CLI's typed commands so Claude Code / Codex / Cursor can drive the engine without parsing CLI stdout.

The runtime preview iframe (`RuntimeGameFrame.tsx`) gets a second mode: instead of only pointing at a dev-server `scriptUrl`, it can mount a `.pixl` from an in-memory virtual FS (Blob URLs) — so `Open .pixl` in the editor loads the project + assets + bundle from a single file, and `Play` runs it inside the same iframe with zero network.

### `.pixl` layout (v1)

```
my-game.pixl  (ZIP)
├── project.pixlproject.json        (canonical schema v2; runtimeManifest required)
├── manifest.pixl.json              (NEW — package-level manifest: format, hashes, runtime kind)
├── Assets/
│   ├── 3D_Models/                  *.glb, *.fbx — only in three-3d packages
│   ├── Sprites/                    *.png, atlases — only in phaser-2d packages
│   ├── Tilemaps/                   *.tilemap.json — only in phaser-2d packages
│   ├── Textures/                   *.png, *.jpg, *.hdr
│   ├── Audio/                      *.ogg, *.mp3
│   ├── Materials/                  *.pixlmat.json
│   └── Prefabs/                    *.pixlprefab.json
├── Scenes/                         *.pixlscene.json (one per scene)
├── Scripts/                        *.pixlscript.js (ESM, sandboxed)
├── ProjectSettings/                build.json, input.json, audio.json
└── Builds/                         (OPTIONAL — populated by export-*)
    ├── three-web/                  index.html + bundle.js + assets/ (3D games)
    └── phaser-web/                 index.html + bundle.js + assets/ (2D games)
```

`manifest.pixl.json`:

```json
{
  "format": "pixl-package",
  "formatVersion": 1,
  "engine": { "name": "PixlPlayground", "version": "0.2.0", "schemaVersion": 2 },
  "runtime": { "primary": "three-3d", "renderers": ["three"], "physics": ["rapier"] },
  "createdAt": 1779600000000,
  "packedAt": 1779700000000,
  "contentHash": "sha256:…",
  "files": [
    { "path": "project.pixlproject.json", "size": 2480, "sha256": "…" },
    { "path": "Assets/3D_Models/Farm.glb", "size": 13551104, "sha256": "…" },
    …
  ]
}
```

The hash list is the contract: re-packing a project produces the same `.pixl` if and only if nothing changed.

### CLI additions (extend, don't rewrite)

```
# Package container
pixl-engine pack    <project-dir>   <out.pixl>     # folder -> ZIP
pixl-engine unpack  <in.pixl>       <project-dir>  # ZIP -> folder (verifies hashes)

# Standalone runtime bundles
pixl-engine export-three     <project> <out-dir>   # Three.js + Rapier + DOM, esbuild
pixl-engine export-phaser    <project> <out-dir>   # Phaser 4 + DOM, esbuild
pixl-engine export-pixlland  <project> <out.zip>   # Pixlland portal submission package
```

The four export commands write into `Builds/` (so they show up inside the `.pixl` if the user packs after exporting), or anywhere outside the project on demand.

### MCP server (`@pixlland/engine-mcp`)

A new workspace package that wraps the CLI through MCP. Tools exposed:

```
project.validate(path)            -> runs validate, returns structured errors/warnings
project.outdated(path)            -> dep drift report
project.migrate(path, dry?)       -> aligns manifest, with --dry support
project.new(dir, kind, name?)     -> scaffold (calls CLI new)

package.pack(projectDir, outFile) -> .pixl write
package.unpack(inFile, outDir)    -> .pixl read

export.three(project, outDir)
export.phaser(project, outDir)
export.pixlland(project, outZip)

scene.read(projectPath, sceneId)
scene.writeObject(projectPath, sceneId, objectId, transform|components|tags)
scene.addObject(projectPath, sceneId, type, transform, components?)
scene.removeObject(projectPath, sceneId, objectId)

assets.add(projectPath, sourceFilePath, kind, targetSubpath?)
assets.remove(projectPath, assetId)

script.read(projectPath, scriptPath)
script.write(projectPath, scriptPath, contents)
```

Every write goes through `pixl-engine validate` before returning success. Schema violation = transactional failure (file not written).

This is the surface the user opens to **any** AI — Claude Code, Codex, Cursor, a future agent. The agent never edits the project JSON blindly; it issues structured MCP calls that the engine validates.

### Editor UI wiring (small, additive)

`EditorHeader.tsx` already has menus. Add to the **File** menu:

- **Open Project…** (existing) — folder-based open.
- **Open .pixl…** (new) — unpacks ZIP into an OPFS-backed scratch folder, then routes through the existing `applyProjectDocumentToEditor`.
- **Save** (existing) — saves loose folder.
- **Save as .pixl…** (new) — calls `pack` over the current project folder, writes the ZIP via File System Access API.
- **Build → Export 3D Web (Three.js)** — calls `export-three`, opens the resulting folder.
- **Build → Export 2D Web (Phaser 4)** — calls `export-phaser`.
- **Build → Pack & Submit to Pixlland** — calls `export-pixlland`, hands off to the portal submit flow.

In the browser (no Node CLI), `pack`/`unpack`/`export-*` run via a **shared core** (`engine/packages/core/`, see Action Items §1) so the CLI and the editor share the implementation. In the Tauri desktop app (PLAN item 7), the editor shells out to the bundled CLI binary.

---

## Options Considered

### Option A — Folder-only (status quo)

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | None |
| Scalability | Low (no portability across machines, no "send my game to a friend") |
| Team familiarity | High |

**Pros:** Already works. The existing local Open/Save is the simplest possible flow.
**Cons:** Does not satisfy the user's "save it locally, open it locally as a single file." No portable build. Cannot ship `.pixl` to a portal as one artifact.

### Option B — `.pixl` as a custom binary container (TLV or capnproto)

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Cost | High (custom (de)serializer, custom inspector, no off-the-shelf tools) |
| Scalability | Marginally better compression than ZIP+Deflate |
| Team familiarity | Low |

**Pros:** Could embed a streaming asset index.
**Cons:** Reinvents what ZIP already gives us. No `unzip my-game.pixl` for debugging. Worse interop with Node, browsers, GitHub releases.

### Option C — **`.pixl` = ZIP container + extend the existing CLI + ship a thin MCP layer.** (Recommended)

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Medium — ~2 weeks of focused work split into 3 phases |
| Scalability | High — every tool that opens a ZIP works (`unzip`, GitHub, Hugging Face Spaces, etc.) |
| Team familiarity | High — `fflate` is tiny and standard; CLI is already in TS |

**Pros:** Reuses every part of the engine that's already built. ZIP is the same format Godot, Unity (`.unitypackage`), and Unreal (`.upack`) all use under the hood. The MCP surface is what the user explicitly asked for.
**Cons:** ZIP can't stream sub-resources mid-file without a smart loader — fine for our scale (a packed Harvest Rush is ~50 MB), but if a single GLB ever exceeds 200 MB we'll need a content-addressed store on the side.

---

## Trade-off Analysis

Option C wins on every dimension that matters for the user's stated goal. It costs a fraction of B because everything is additive — the editor, the runtime preview, the CLI, the schema, the manifest, the round-trip identity test all stay. We just add three layers on top: **container**, **exporters**, and **agent surface**. ZIP's only real weakness (streaming) doesn't bite at the size of casual-web games.

---

## Consequences

- **Becomes easier:**
  - User saves `my-game.pixl`, mails it, opens it on the MacBook, keeps editing.
  - Pixlland portal accepts a single `.pixl` upload instead of a folder.
  - Any AI (Claude Code, Codex, Cursor, future) drives the engine through a typed surface that **always** runs `validate` before writing.
  - "Build" menu produces a runnable HTML+JS bundle the user can host anywhere.
- **Becomes harder:**
  - Three.js asset paths in `Builds/three-web/` now need rewriting at export time (currently they point at the dev server). The exporter has to walk the scene and rebase URLs into the bundle's `assets/`.
  - Migrations across schema versions need a "pack → unpack → migrate → repack" path; the manifest's `contentHash` invalidates after every migration (intentional).
- **What we'll need to revisit:**
  - At ~200 MB+ projects, switch `.pixl` to a tarball with a side content-addressed store. Not now.
  - Whether the MCP server should accept WebSocket from the editor itself (so the in-browser editor can call MCP tools the same way an external agent does) — defer to after Phase 3.

---

## Phased Plan

Each phase ends with a working Harvest Rush demo. Owner gate at each.

### Phase 1 — `.pixl` Pack/Unpack + File menu wiring (~3–4 days)

**Deliverables**

1. New workspace package `engine/packages/core/`:
   - `packProject(projectDir): Promise<Uint8Array>` and `unpackPackage(bytes, targetDir): Promise<ManifestPixl>` using `fflate` (~13 KB).
   - `computeProjectContentHash(projectDir)` — sha256 of every file, deterministic ordering.
   - Writes/reads `manifest.pixl.json`.
   - Pure TS, no Node-only APIs in the hot path so the same code runs in the browser via OPFS.
2. CLI: `pixl-engine pack` and `unpack` calling `@pixlland/engine-core`. Smoke against the real Harvest Rush project (must round-trip byte-equivalent).
3. Editor:
   - File menu **Save as .pixl…** (writes a Blob via `showSaveFilePicker`).
   - File menu **Open .pixl…** (reads via `showOpenFilePicker`, unpacks into OPFS, then calls existing `applyProjectDocumentToEditor`).
4. `runtimePreview.ts`: when the project came from an OPFS-unpacked `.pixl`, resolve `scriptUrl` against Blob URLs minted from OPFS instead of dev-server paths.

**Done means**

1. Open the sample → **Save as .pixl** → produces `harvest-rush.pixl` (~50 MB).
2. Close the project. **Open .pixl** the file → identical scene loads.
3. Press **Play** → game runs from inside the unpacked `.pixl` (no dev server hit for project files).
4. `pixl-engine pack ./apps/portal/games-src/harvest-rush-3d/pixlplayground harvest-rush.pixl` produces a byte-identical file.
5. Validate passes; round-trip identity for level3d unchanged.

### Phase 2 — Exporters (`export-three`, `export-phaser`, `export-pixlland`) (~5–6 days)

**Deliverables**

1. `engine/packages/exporters/three-web/`:
   - esbuild config that bundles a Three.js + R3F + Rapier runtime entry, with the project's scene data, scripts, and assets inlined or referenced into `Builds/three-web/`.
   - HTML shell with `<canvas>` + DOM HUD slot.
2. `engine/packages/exporters/phaser-web/`:
   - Same shape but Phaser 4 entry. **Refuses** non-2D scenes (errors loud).
3. `engine/packages/exporters/pixlland/`:
   - Wraps either exporter into a `submit.zip` matching the portal's expected layout.
4. CLI commands wire to the exporters. Same flags: `--minify`, `--source-maps`, `--target-size <kb>`.
5. Editor **Build** menu calls these and surfaces progress + output path.

**Done means**

- `pixl-engine export-three ./harvest-rush.pixlproject.json Builds/web` → `index.html` opens in any browser and the game runs (no dev server).
- Bundle ≤ 10 MB gzipped excluding GLB assets (Three+R3F+Rapier+game scripts).
- Exporter refuses to bundle 2D-only components into a 3D bundle (and vice versa), enforced by the schema's `PIXL_2D_COMPONENT_TYPES` / `PIXL_3D_COMPONENT_TYPES` constants that already exist.

### Phase 3 — MCP server (~3–4 days)

**Deliverables**

1. New workspace package `engine/packages/mcp/` (`@pixlland/engine-mcp`).
2. Implements MCP server (stdio + websocket transport) exposing the 16 tools listed above.
3. Every write tool runs `validate` post-write and rolls back on failure (write to temp file → validate → atomic rename).
4. Per-tool JSON schemas published, so Claude Code / Codex auto-introspect.
5. Installable via `pnpm dlx @pixlland/engine-mcp` or wired into the existing `.mcp.json` of this repo.
6. `engine/HANDOFF-MAC.md` documents how to point Claude Code at it.

**Done means**

- From Claude Code in this repo, an agent can: `project.validate`, `scene.addObject(...)`, `assets.add(...)`, `package.pack(...)` — and the editor (running with the same project folder open) hot-reloads the changes.
- Agent's writes are blocked by `validate` on bad inputs (test: try writing a `pixl.sprite` into a `kind: '3d'` scene → tool returns structured error, no file change).

---

## Consequences for the existing `PLAN.md`

This ADR **does not replace** `engine/PLAN.md` — it answers item 5 of that plan ("CLI continues before MCP" → "next commands: `export-three`, `export-phaser`, `export-pixlland`") and item 8 ("MCP server depois que o CLI tiver 5-6 comandos estabilizados"). After Phase 1, the CLI has 8 commands; after Phase 2, 11. MCP becomes the right next step.

Items 1, 2, 3, 6 of `PLAN.md` keep their priorities. Item 4 (dep alignment with manifest) is already partly done in this branch.

---

## Action Items — Owner

1. [ ] Approve **Option C** and the **3-phase plan**.
2. [ ] Confirm `.pixl` = **ZIP + manifest.pixl.json + content hashes**.
3. [ ] Confirm the MCP tool list above (or trim/extend before Phase 3).
4. [ ] Authorize **Phase 1** to start immediately (~3–4 days).

## Action Items — Engine Agent (Phase 1, in order)

1. [ ] Create workspace package `engine/packages/core/` with `package.json` (`@pixlland/engine-core`), `tsconfig.json`, `vitest.config.ts`.
2. [ ] Add `fflate` to `@pixlland/engine-core` dependencies.
3. [ ] Implement `packProject`, `unpackPackage`, `computeProjectContentHash`, `readManifestPixl`, `writeManifestPixl` in `engine/packages/core/src/`.
4. [ ] Move the existing `localProjectFiles.ts` IO helpers used by both the editor and the CLI into `@pixlland/engine-core` so both share code (the CLI today imports nothing from the studio).
5. [ ] Wire CLI: `pixl-engine pack` and `unpack`, vitest covering byte-identity round-trip on the real Harvest Rush project.
6. [ ] Editor `EditorHeader.tsx`: add **Open .pixl…** and **Save as .pixl…** menu entries. Use OPFS for in-browser unpacked state.
7. [ ] Update `runtimePreview.ts` to mint Blob URLs from OPFS when the project source is a `.pixl` (new `RuntimePreviewSource = 'pixl-package'`).
8. [ ] Smoke: full loop (Open sample → Save as .pixl → close → Open .pixl → Play → identical run).
9. [ ] `pnpm engine:typecheck && pnpm engine:test && pnpm --filter @pixlland/engine-cli test` all green.
10. [ ] Update `engine/HANDOFF-MAC.md` with the new commands.
