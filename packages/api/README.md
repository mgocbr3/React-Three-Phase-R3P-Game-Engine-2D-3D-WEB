# @pixlland/engine-api

> GDD §6.4 — Phase 4. HTTP + WebSocket server that exposes
> `@pixlland/engine-ops` over the network. Default port: **8765**.

## Run

```bash
pnpm --filter @pixlland/engine-api build
pnpm --filter @pixlland/engine-api start
# or directly:
node engine/packages/api/dist/index.js
# port can be overridden via PORT or PIXL_API_PORT env var
```

## REST surface

```
GET  /healthz                       → "ok"
GET  /tools                         → JSON catalog (same as @pixlland/engine-mcp tools list)
GET  /project?projectDir=ABS_PATH   → current PixlProjectShape
POST /ops/:name                     → invoke op, body is JSON args (must include projectDir)
```

Example:

```bash
curl -X POST http://localhost:8765/ops/object.add \
  -H 'content-type: application/json' \
  -d '{"projectDir":"/abs/path","sceneId":"main","parentId":null,"type":"cube"}'
```

Response is the raw `OpResult` (`{ ok, changedFiles, contentHash, ... }`)
with HTTP status 200 on `ok:true` and 400 on `ok:false`.

## WebSocket surface

Endpoint: `ws://localhost:8765/ws`.

The server attaches a listener to engine-ops' `broadcastProjectEvent`
emitter and forwards every event as a JSON text frame:

```json
{ "type": "object.added", "sceneId": "main", "objectId": "obj_x",
  "contentHash": "...", "byAgent": "http" }
```

Clients SHOULD ignore events where `byAgent === 'editor'` (or whatever
self-identifier they use) to avoid feedback loops.

Smoke test with `wscat`:

```bash
wscat -c ws://localhost:8765/ws
# In another shell:
curl -X POST localhost:8765/ops/scene.create -d '...'
# The wscat console prints the scene.created event.
```

## Architecture

- `src/app.ts` builds the Hono app. Pure function — does not bind to a
  port. Tests import this and run requests against it via the
  `Hono.fetch` web-standard API.
- `src/ws.ts` attaches the WebSocket server to a Node `http.Server`
  instance. Forwards engine-ops events to clients.
- `src/index.ts` boots the Node server: Hono + WS on the same port.
- `src/dispatch.ts` maps each op name to the corresponding engine-ops
  call. Mirrors `engine-mcp/src/tools.ts` but uses `agent: 'http'`.

This package adds NO business logic — it's a transport adapter. The
contract enforced by engine-ops (load → validate → mutate → write →
broadcast) is inherited unchanged.
