import { backendUrl, isTauriDesktop } from '@/utils/api';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { TauriHttpTransport, TauriStdioTransport } from '@/utils/mcp';
import type { zSettings } from '@tiny-chat/shared/src/types/user';
import type { Tool } from '@modelcontextprotocol/sdk/types';

export const McpService = {
  clients: [] as Client[],

  connect: async (mcpServerSettings: zSettings['mcpServers']) => {
    console.log('connecting with mcpServerSettings:', mcpServerSettings);

    if (!mcpServerSettings) {
      await McpService.disconnect();
      return;
    }

    const mcps: {
      server: NonNullable<zSettings['mcpServers']>[number];
      client: Client;
      tools: Tool[];
    }[] = [];
    const newClients: Client[] = [];

    for (let i = 0; i < mcpServerSettings.length; i++) {
      const server = mcpServerSettings[i];
      const client = new Client({ version: '0', name: 'tiny-chat' });

      const tryConnect = async (transport: Transport) => {
        try {
          const onerror = transport.onerror;
          await new Promise((resolve, reject) => {
            transport.onerror = (e) => {
              onerror?.(e);
              reject(e);
            };
            client.connect(transport).then(resolve).catch(reject);
          });
          transport.onerror = onerror;
          newClients.push(client);

          const { tools } = await client.listTools();
          mcps.push({ server, client, tools });

          return true;
        } catch (e) {
          console.warn(`mcp ${i} error:`, e);
          await client.close();

          return false;
        }
      };

      if (server.type === 'local' && (await isTauriDesktop())) {
        await tryConnect(new TauriStdioTransport(i.toString(), server.command, server.env));
      } else if (server.type === 'remote') {
        const headers: Record<string, string> =
          server.auth?.type === 'token' ? { Authorization: `Bearer ${server.auth.token}` } : {};

        if (
          await tryConnect(
            new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers } }),
          )
        )
          continue;

        if (
          (await isTauriDesktop()) &&
          (await tryConnect(new TauriHttpTransport(i.toString(), server.url, headers)))
        )
          continue;

        if (
          await tryConnect(
            new StreamableHTTPClientTransport(new URL(`${backendUrl}/@/mcp`), {
              requestInit: { headers: { 'X-MCP-URL': server.url, ...headers } },
            }),
          )
        )
          continue;

        console.error(`mcp failed all transports:`, server); // TODO - push with error field
      }
    }

    // swap to prevent mcp server disconnects
    const oldClients = McpService.clients.splice(0, McpService.clients.length, ...newClients);
    for (const client of oldClients) {
      await client.close().catch((e) => console.warn('mcp close error:', e));
    }

    return mcps;
  },

  disconnect: async () => {
    const clients = McpService.clients.splice(0, McpService.clients.length);
    for (const client of clients) {
      await client.close().catch((e) => console.warn('mcp close error:', e));
    }
  },
} as const;
