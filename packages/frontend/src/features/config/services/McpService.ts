import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import type { Tool } from "@modelcontextprotocol/sdk/types";
import { backendUrl, isTauriDesktop } from "#frontend/utils/api.ts";
import {
	TauriHttpTransport,
	TauriStdioTransport,
} from "#frontend/utils/mcp.ts";
import type { zMCPServers } from "#shared/features/data/types/user.ts";

export const McpService = {
	clients: [] as Client[],

	connect: async (mcpServerSettings?: zMCPServers) => {
		console.log("[McpService] connecting to server:", mcpServerSettings);

		if (!mcpServerSettings) {
			await McpService.disconnect();
			return [];
		}

		const mcps: {
			name: string;
			server: NonNullable<zMCPServers>[string];
			client: Client;
			error?: unknown;
			tools: Tool[];
		}[] = [];
		const connected: Client[] = [];

		for (const [name, server] of Object.entries(mcpServerSettings)) {
			const client = new Client({ version: "0", name: "tiny-chat" });
			let tools: Tool[] = [];
			let error: unknown;

			const tryConnect = async (transport: Transport) => {
				console.log("[McpService] starting transport:", name, transport);
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
					connected.push(client);
					tools = (await client.listTools()).tools;
					console.log("[McpService] started:", name, tools);
					return true;
				} catch (e) {
					console.log("[McpService] failed to start:", e);
					error = new Error("failed to connect");
					await client.close();
					return false;
				}
			};

			const isDesktop = await isTauriDesktop();

			if ("command" in server) {
				if (isDesktop) {
					await tryConnect(
						new TauriStdioTransport(
							name,
							[server.command, ...(server.args ?? [])],
							server.env,
						),
					);
				} else {
					error = new Error("requires desktop app");
				}
			} else if ("url" in server) {
				const isLocal =
					["192.168.", "10.", "172.16.", "fc00:"].some((prefix) =>
						new URL(server.url).hostname.startsWith(prefix),
					) ||
					["localhost", "127.0.0.1", "::1"].includes(
						new URL(server.url).hostname,
					) ||
					[".home", ".local"].some((suffix) =>
						new URL(server.url).hostname.endsWith(suffix),
					);

				let transports: Transport[];
				if (isLocal) {
					if (isDesktop)
						transports = [
							new TauriHttpTransport(name, server.url, server.headers),
						];
					else
						transports = [
							new StreamableHTTPClientTransport(new URL(server.url), {
								requestInit: { headers: server.headers },
							}),
						];
				} else {
					transports = [
						new StreamableHTTPClientTransport(new URL(`${backendUrl}/@/mcp`), {
							requestInit: {
								headers: { "X-Mcp-Url": server.url, ...(server.headers ?? {}) },
							},
						}),
					];
				}

				for (const transport of transports) {
					if (await tryConnect(transport)) {
						break;
					}
				}
			}

			mcps.push({ name, server, client, error, tools });
		}

		// swap to prevent mcp server disconnects
		const oldClients = McpService.clients.splice(
			0,
			McpService.clients.length,
			...connected,
		);
		for (const client of oldClients) {
			await client.close().catch((e) => console.warn("mcp close error:", e));
		}

		return mcps;
	},

	disconnect: async () => {
		const clients = McpService.clients.splice(0, McpService.clients.length);
		for (const client of clients) {
			await client
				.close()
				.catch((e) => console.warn("[McpService] error during disconnect:", e));
		}
	},
} as const;
