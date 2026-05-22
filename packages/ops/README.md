# @pixlland/engine-ops

> GDD §6.1 — Phase 1. Pure TypeScript library. Zero React, zero Three, zero
> Phaser. **The single, validated write surface for every PixlPlayground
> project on disk.**

Every write to a `.pixlproject.json` (whether from the studio chrome, the
CLI, the MCP server, the HTTP+WS server, or a future SDK) must go through
this library. The studio is just another consumer of ops; it has no
privileged write path.

## Lifecycle (every op)

```
load → validate → mutate → re-validate → atomic write → broadcast WS
```

If `validate` (pre) or `validate` (post) fails, the file is **never
written** and the op returns `{ ok: false, validationErrors: [...] }`.

## Op signature

```ts
import { OpContext, OpResult } from '@pixlland/engine-ops';

export async function addObject(
  ctx: OpContext,                       // { projectDir, agent, reason? }
  args: {
    sceneId: string;
    parentId: string | null;
    type: string;
    transform?: { position?: [number,number,number]; rotation?: [number,number,number]; scale?: [number,number,number] };
    components?: Array<{ id?: string; type: string; enabled?: boolean; data?: Record<string, unknown> }>;
  },
): Promise<OpResult>;
```

`OpResult`:

```ts
interface OpResult {
  ok: boolean;
  changedFiles: string[];      // relative to projectDir
  contentHash: string;          // sha256 hex of the post-mutation doc
  validationWarnings: string[];
  validationErrors: string[];
}
```

## Op catalog (21 ops)

| Category | Op | What it does |
|---|---|---|
| project | `createProject` | Scaffold a new project folder on disk (3D or 2D) |
| project | `validateProject` | Re-run schema + 2D/3D coherence check |
| project | `packProject` | Bundle project folder into `.pixl` |
| project | `unpackProject` | Reverse: `.pixl` → folder |
| scene   | `createScene` | Add a new scene (`2d`/`3d`/`hybrid`) |
| scene   | `deleteScene` | Remove a scene (refuses if active or only one) |
| scene   | `setActiveScene` | Update `activeSceneId` |
| object  | `addObject` | Append a new object under `parentId` or root |
| object  | `updateObject` | Patch arbitrary object fields (name, visible, locked, tags) |
| object  | `removeObject` | Remove an object and all descendants |
| object  | `reparentObject` | Move object to a different parent |
| object  | `setObjectTransform` | Replace position/rotation/scale |
| object  | `setObjectComponent` | Add, update, or remove a component instance |
| asset   | `importAsset` | Register an asset entry (URL or path) |
| asset   | `removeAsset` | Drop an asset entry by id |
| script  | `readScript` | Read a file from `Scripts/` |
| script  | `writeScript` | Write to `Scripts/<path>` (atomic) |
| script  | `deleteScript` | Remove a file from `Scripts/` |
| build   | `exportThree` | Stub — Phase 4 of ADR-003 |
| build   | `exportPhaser` | Stub — Phase 5 |
| build   | `exportPixlland` | Stub — bundle `.pixl` for Pixlland portal |

## Broadcast

Every successful op emits a `ProjectEvent` via `broadcast.ts`. Consumers
subscribe via `subscribeProjectEvents(listener)`. The HTTP+WS server
(Phase 4) bridges these to WebSocket clients.

```ts
type ProjectEvent =
  | { type: 'object.added'; sceneId: string; objectId: string; contentHash: string; byAgent: string }
  | { type: 'object.updated'; sceneId: string; objectId: string; fields: string[]; contentHash: string; byAgent: string }
  // ...see src/types.ts for the full union
```

## Locking

In-process mutex per `projectDir` — concurrent ops on the same folder
serialize. Cross-process locking (file-system lock) is out of scope for
Phase 1; the editor + agents run in the same Node process (the HTTP+WS
server) so an in-process mutex is sufficient until then.

## Why this package exists (GDD §0)

> "Every write goes load → validate → mutate → re-validate → atomic write →
> broadcast WS. The studio is just another consumer of ops; it has no
> privileged write path."

Before this, every transport (editor / CLI / MCP) had its own write path
with its own validation rules — drift was inevitable. By funneling every
write through one library, the contract is enforced once, in TypeScript,
with tests.
