// Build a PixlPlayground MCP server. Pure function — does NOT bind to a
// transport. The bin (index.ts) does that; tests import this directly.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { callOpTool, listOpTools } from './tools.js';

export interface BuildServerOptions {
  name?: string;
  version?: string;
}

export const buildPixlMcpServer = (options: BuildServerOptions = {}): Server => {
  const server = new Server(
    {
      name: options.name ?? 'pixlplayground',
      version: options.version ?? '0.0.1',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listOpTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const payload = await callOpTool(name, (args ?? {}) as Record<string, unknown>);
    return {
      isError: payload.isError,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(payload.result, null, 2),
        },
      ],
    };
  });

  return server;
};
