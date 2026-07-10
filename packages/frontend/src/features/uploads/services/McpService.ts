import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import type { Tool } from "@modelcontextprotocol/sdk/types";
import { backendUrl, isTauriDesktop } from "#frontend/utils/api.ts";
import {
	TauriHttpTransport,
	TauriStdioTransport,
} from "#frontend/utils/mcp.ts";
import type { zSettings } from "#shared/types/user";

export const McpService = {
	clients: [] as Client[],

	connect: async (mcpServerSettings: zSettings["mcpServers"]) => {
		console.log("connecting with mcpServerSettings:", mcpServerSettings);

		if (!mcpServerSettings) {
			await McpService.disconnect();
			return;
		}

		const mcps: {
			server: NonNullable<zSettings["mcpServers"]>[number];
			client: Client;
			error?: unknown;
			tools: Tool[];
		}[] = [];
		const connected: Client[] = [];

		for (let i = 0; i < mcpServerSettings.length; i++) {
			const server = mcpServerSettings[i];
			const client = new Client({ version: "0", name: "tiny-chat" });
			let tools: Tool[] = [];
			let error: unknown;

			const tryConnect = async (transport: Transport) => {
				console.log("connecting to mcp server:", server.name, transport);
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
					return true;
				} catch (e) {
					console.log("mcp error:", e);
					error = new Error("Failed to connect");
					await client.close();
					return false;
				}
			};

			const isDesktop = await isTauriDesktop();

			if (server.type === "stdio") {
				if (isDesktop) {
					await tryConnect(
						new TauriStdioTransport(i.toString(), server.command, server.env),
					);
				} else {
					error = new Error("Requires desktop app");
				}
			} else if (server.type === "http") {
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

				const headers: Record<string, string> =
					server.auth?.type === "bearer"
						? { Authorization: `Bearer ${server.auth.token}` }
						: {};

				let transports: Transport[];
				if (isLocal) {
					if (isDesktop)
						transports = [
							new TauriHttpTransport(server.name, server.url, headers),
						];
					else
						transports = [
							new StreamableHTTPClientTransport(new URL(server.url), {
								requestInit: { headers },
							}),
						];
				} else {
					transports = [
						new StreamableHTTPClientTransport(new URL(`${backendUrl}/@/mcp`), {
							requestInit: { headers: { "X-Mcp-Url": server.url, ...headers } },
						}),
					];
				}

				for (const transport of transports) {
					if (await tryConnect(transport)) {
						break;
					}
				}
			}

			mcps.push({ server, client, error, tools });
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
			await client.close().catch((e) => console.warn("mcp close error:", e));
		}
	},
} as const;
