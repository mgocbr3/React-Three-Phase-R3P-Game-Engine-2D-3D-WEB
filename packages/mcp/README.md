# @pixlland/engine-mcp

> GDD §6.3 — Phase 3. MCP stdio server that exposes the 21 ops from
> `@pixlland/engine-ops` to any MCP-capable client (Claude Code, MCP
> Inspector, custom agents).

## Install in Claude Code

Add to your MCP servers manifest (typically `.claude/settings.json`):

```json
{
  "mcpServers": {
    "pixlplayground": {
      "command": "node",
      "args": ["./engine/packages/mcp/dist/index.js"]
    }
  }
}
```

Or, once published to npm:

```json
{
  "mcpServers": {
    "pixlplayground": {
      "command": "pnpm",
      "args": ["dlx", "@pixlland/engine-mcp"]
    }
  }
}
```

Then in a Claude Code session inside the repo:

```
@pixlplayground project.validate { "projectDir": "/abs/path/to/project" }
@pixlplayground object.add { "projectDir": "/abs/path", "sceneId": "main",
                              "parentId": null, "type": "cube" }
```

## Tool catalog

21 tools mirroring the engine-ops public surface. Each tool's name is the
op's dotted name (`project.create`, `object.add`, etc.). Schemas are
derived from `@pixlland/engine-ops`'s catalog (see `src/schemas.ts`).

Every tool's first parameter is `projectDir: string` (absolute path to a
project folder). The rest are the op-specific args.

## Architecture

- **No business logic.** This package is a transport adapter — every
  call delegates to a function in `@pixlland/engine-ops`.
- **Errors are structured.** An op returning `{ ok: false,
  validationErrors: [...] }` becomes an MCP tool response with the same
  shape (not an MCP-level error). MCP-level errors are reserved for
  protocol issues (unknown tool, missing required args).
- **State is on disk.** The server doesn't keep any in-memory model of
  the project; every call re-reads `project.pixlproject.json`. Multiple
  concurrent agents are safe (engine-ops' in-process lock plus atomic
  writes).

## Test strategy

The stdio transport is exercised by the MCP SDK itself; in our vitest
suite we test:

- `listTools()` returns the expected catalog (21 tools, correct names,
  required args)
- `callTool(name, args)` dispatches to the right op and propagates the
  result
- Unknown tool name yields a structured error
- Missing `projectDir` yields a structured error
- An op returning `ok: false` surfaces as a tool result with
  `isError: true` and a content block carrying the validationErrors
