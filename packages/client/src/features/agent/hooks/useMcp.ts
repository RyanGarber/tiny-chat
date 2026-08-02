import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import type { Tool } from "@modelcontextprotocol/sdk/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zMCPServers } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useMcpServerSettings } from "../../settings/hooks/useMcpServerSettings.ts";
import { useMcpStore } from "../stores/useMcpStore.ts";

export const mcpServersQueryKey = ["useMcp", "mcpServers"] as const;
export const disconnectMcpServersQueryKey = [
	"useMcp",
	"disconnectMcpServers",
] as const;

export const useMcp = () => {
	const client = useContext(ClientProvider);

	const { mcpServerSettings } = useMcpServerSettings();
	const connectedServers = useMcpStore((state) => state.connectedServers);
	const setConnectedServers = useMcpStore((state) => state.setConnectedServers);

	const mcpServers = useQuery({
		queryKey: [mcpServersQueryKey, JSON.stringify(mcpServerSettings.data)],
		queryFn: async () => {
			if (!mcpServerSettings.data) {
				disconnectMcpServers.mutate();
				return [];
			}

			console.log("[useMcp] connecting to servers:", mcpServerSettings.data);

			const mcpServers: {
				name: string;
				server: NonNullable<zMCPServers>[string];
				client: Client;
				error?: unknown;
				tools: Tool[];
			}[] = [];

			const connections: Client[] = [];

			for (const [name, server] of Object.entries(mcpServerSettings.data)) {
				const mcpClient = new Client({ version: "0", name: "tiny-chat" });
				let tools: Tool[] = [];
				let error: unknown;

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
					if (!isLocal) {
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

				for (const transport of transports) {
					console.log("[useMcp] starting transport:", name, transport);
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
						connections.push(mcpClient);
						tools = (await mcpClient.listTools()).tools;
						console.log("[useMcp] started:", name, tools);
						break;
					} catch (e) {
						console.log("[useMcp] failed to start:", e);
						error = new Error("failed to connect");
						await mcpClient.close();
					}
				}

				mcpServers.push({ name, server, client: mcpClient, error, tools });
			}

			// swap to prevent mcp server disconnects
			const oldConnections = [...connectedServers];

			setConnectedServers(connections);

			for (const mcpClient of oldConnections) {
				await mcpClient
					.close()
					.catch((e) => console.warn("[useMcp] mcp close error:", e));
			}

			return mcpServers;
		},
		staleTime: Infinity,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
	});

	const disconnectMcpServers = useMutation({
		mutationKey: disconnectMcpServersQueryKey,
		mutationFn: async () => {
			console.log("[useMcp] disconnecting all servers");

			const oldConnections = [...connectedServers];
			for (const mcpClient of oldConnections) {
				await mcpClient
					.close()
					.catch((error) =>
						console.warn("[useMcp] error during disconnect:", error),
					);
			}
		},
	});

	return { mcpServers, disconnectMcpServers };
};
