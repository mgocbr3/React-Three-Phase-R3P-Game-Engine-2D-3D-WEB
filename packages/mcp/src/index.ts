#!/usr/bin/env node
// Stdio entry point for the PixlPlayground MCP server.
// Add to .claude/settings.json mcpServers section to expose to Claude Code.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildPixlMcpServer } from './server.js';

const main = async (): Promise<void> => {
  const server = buildPixlMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[pixl-mcp] fatal:', error);
  process.exit(1);
});
