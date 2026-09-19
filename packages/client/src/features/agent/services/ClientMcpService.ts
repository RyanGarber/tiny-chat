import {
	Client as McpClient,
	StreamableHTTPClientTransport,
	type Tool,
	type Transport,
} from "@modelcontextprotocol/client";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zMCPServers } from "@tiny-chat/core/src/features/data/types/user.ts";
import type { Client } from "../../../client.ts";

export type McpServerSetting = NonNullable<zMCPServers>[string];

export interface McpServer {
	/** Identifies a single connection attempt, so consumers notice reconnects. */
	id: string;
	name: string;
	server: McpServerSetting;
	client: McpClient;
	error?: unknown;
	tools: Tool[];
}

const isLocalUrl = (url: string) => {
	const { hostname } = new URL(url);
	return (
		["192.168.", "10.", "172.16.", "fc00:"].some((prefix) =>
			hostname.startsWith(prefix),
		) ||
		["localhost", "127.0.0.1", "::1"].includes(hostname) ||
		[".home", ".local"].some((suffix) => hostname.endsWith(suffix))
	);
};

export const ClientMcpService = {
	/**
	 * A key that changes whenever a server's connection details change.
	 */
	getServerKey: ({ server }: { server: McpServerSetting }) => {
		return "url" in server
			? `${server.url}:${JSON.stringify(server.headers ?? {})}`
			: `${server.command}:${JSON.stringify(server.args ?? [])}:${JSON.stringify(server.env ?? {})}`;
	},

	getTransports: ({
		client,
		name,
		server,
	}: {
		client: Client;
		name: string;
		server: McpServerSetting;
	}) => {
		const transports: Transport[] = [];

		if ("command" in server) {
			// Use client transport for commands
			if (client.transports?.createStdio) {
				transports.push(
					client.transports.createStdio({
						name,
						command: [server.command, ...(server.args ?? [])],
						env: server.env,
					}),
				);
			}
		} else if ("url" in server) {
			// Always prefer the client transport
			if (client.transports?.createStreamableHttp) {
				transports.push(
					client.transports.createStreamableHttp({
						name,
						url: new URL(server.url),
						headers: server.headers,
					}),
				);
			}

			// Prefer the relay to prevent CORS errors
			if (!isLocalUrl(server.url)) {
				transports.push(
					new StreamableHTTPClientTransport(
						new URL(`${client.serverUrl}${CommonUtils.endpoints.mcp}`),
						{
							requestInit: {
								headers: { "X-Mcp-Url": server.url, ...server.headers },
							},
						},
					),
				);
			}

			// Fall back to direct connection
			transports.push(
				new StreamableHTTPClientTransport(new URL(server.url), {
					requestInit: { headers: server.headers },
				}),
			);
		}

		return transports;
	},

	/**
	 * Connect to a single server, trying each transport in order.
	 */
	connect: async ({
		client,
		name,
		server,
	}: {
		client: Client;
		name: string;
		server: McpServerSetting;
	}): Promise<McpServer> => {
		const mcpClient = new McpClient({ version: "0", name: "tiny-chat" });

		let tools: Tool[] = [];
		let error: unknown;

		for (const transport of ClientMcpService.getTransports({
			client,
			name,
			server,
		})) {
			console.log(
				`[ClientMcpService] trying transport for ${name}: ${transport.constructor.name}`,
			);
			try {
				const onerror = transport.onerror;
				await new Promise((resolve, reject) => {
					transport.onerror = (e) => {
						onerror?.(e);
						reject(e);
					};
					mcpClient.connect(transport).then(resolve).catch(reject);
				});
				transport.onerror = onerror;
				tools = (await mcpClient.listTools()).tools;
				error = undefined;
				console.log(
					`[ClientMcpService] connected: ${name} (${tools.length} tools)`,
				);
				break;
			} catch (e) {
				console.log("[ClientMcpService] failed to connect:", e);
				error = new Error("failed to connect");
				await mcpClient.close();
			}
		}

		return {
			id: CommonUtils.getRandomId(),
			name,
			server,
			client: mcpClient,
			error,
			tools,
		};
	},

	disconnect: async ({ client }: { client: McpClient }) => {
		await client
			.close()
			.catch((error) =>
				console.warn("[ClientMcpService] error during disconnect:", error),
			);
	},
} as const;
