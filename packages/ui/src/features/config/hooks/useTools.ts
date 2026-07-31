import type { Client } from "@modelcontextprotocol/sdk/client";
import { useQuery } from "@tanstack/react-query";
import type { zToolData } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zMCPServers } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import type {
	Tool,
	Toolset,
} from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { useChat } from "@tiny-chat/react/src/features/chat/hooks/useChat.ts";
import { useChatStore } from "@tiny-chat/react/src/features/chat/stores/useChatStore.ts";
import { useMemo } from "react";
import { useCapabilities } from "#ui/features/capability/hooks/useCapabilities.ts";
import { useMcpServerSettings } from "#ui/features/settings/hooks/useMcpServerSettings.ts";
import { McpService } from "../services/McpService.ts";

export interface McpToolset extends Toolset<void> {
	server: NonNullable<zMCPServers>[keyof NonNullable<zMCPServers>];
	client: Client<any>;
}

export const builtInToolsQueryKey = ["tools"] as const;
export const mcpToolsQueryKey = ["mcp-servers"] as const;

export const useTools = () => {
	const { mcpServerSettings } = useMcpServerSettings();
	const { data: mcpServerSettingsData } = mcpServerSettings;
	const { presumedCapabilities } = useCapabilities();
	const { chat } = useChat();
	const createIncognito = useChatStore((s) => s.createIncognito);

	const nativeTools = useQuery({
		queryKey: [...builtInToolsQueryKey, presumedCapabilities.data],
		queryFn: async () => {
			return await ToolService.getTools({
				capabilities: presumedCapabilities.data ?? {},
				incognito: chat.data?.incognito ?? createIncognito,
			});
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const mcpTools = useQuery({
		queryKey: ["mcp-servers", JSON.stringify(mcpServerSettingsData)], // compare by value to prevent mcp server disconnects
		queryFn: async () => {
			const mcps = await McpService.connect(mcpServerSettingsData);
			return (
				mcps.map(
					({ name, server, client, tools, error }): McpToolset => ({
						name: name.replace("-", "_").toLowerCase(),
						prefix: name.replace("-", "_").toLowerCase(),
						instructions: client.getInstructions(),
						capabilities: void 0,
						status: {
							valid: !error,
							error,
						},
						tools: tools.map(
							(t): Tool<any, void> => ({
								name: t.name,
								description: t.description ?? "",

								input: t.inputSchema,
								output: t.outputSchema,

								execute: async ({ input, ...rest }): Promise<zToolData> => {
									console.log("[useTools] calling mcp tool:", {
										input,
										...rest,
									});
									const { isError, content } = await client.callTool({
										name: t.name,
										arguments: input,
									});
									console.log("[useTools] mcp response:", { isError, content });
									if (isError) throw new Error(JSON.stringify(content));
									return [{ type: "json", value: content }];
								},

								capabilities: void 0,
							}),
						),
						server,
						client,
					}),
				) ?? []
			);
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const { tools, toolsets } = useMemo(() => {
		const toolsets = [...(nativeTools.data ?? []), ...(mcpTools.data ?? [])];
		const tools = toolsets.flatMap((toolset) => toolset.tools);
		return { tools, toolsets };
	}, [nativeTools.data, mcpTools.data]);

	return { nativeTools, mcpTools, tools, toolsets, presumedCapabilities };
};
