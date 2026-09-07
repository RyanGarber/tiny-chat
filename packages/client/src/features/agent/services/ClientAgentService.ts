import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { AgentService } from "@tiny-chat/core/src/features/agent/services/AgentService.ts";
import type { zAgentContext } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type {
	zData,
	zMetadata,
	zToolCallPart,
	zToolResultPart,
} from "@tiny-chat/core/src/features/data/types/part.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { smoothStream } from "ai";
import type { Client } from "../../../client.ts";
import { ClientCapabilityService } from "../../../core/services/ClientCapabilityService.ts";
import {
	AgentStreamService,
	ToolStreamService,
} from "../../../core/services/StreamService.ts";
import { useMessageQueueStore } from "../../chat/stores/useMessageQueueStore.ts";
import { ClientProviderService } from "./ClientProviderService.ts";

export const ClientAgentService = {
	/** Run the generation loop, pumping deltas into the stream registry. */
	runAgent: async ({
		client,
		context,
		data = [],
		metadata = [],
		skills,
		chat,
		prompt,
		mcpTools,
		providers,
		streamKey,
		streamChat,
		toolNames,
		instructions,
	}: {
		client: Client;
		context: zAgentContext;
		data?: zData;
		metadata?: zMetadata;
		chat: ChatState;
		prompt: MessageState;
		skills: zSkill[];
		mcpTools: Toolset<any>[];
		providers: ProviderState<ProviderStatus>[];
		streamKey: string;
		streamChat: string | null;
		toolNames?: string[];
		instructions?: string;
	}): Promise<{ data: zData; metadata: zMetadata }> => {
		console.log(
			"[ClientAgentService] running agent",
			context,
			skills,
			providers,
		);

		const modelProviders = await ClientProviderService.getModelProviders({
			client,
			user: context.user,
		});

		const { prompt: lastPrompt } = AgentUtils.getLastPrompt({
			messages: context.messages,
			withText: false,
		});
		const provider = modelProviders.find(
			(p) => p.name === lastPrompt?.config?.provider,
		);
		if (!provider) {
			throw new Error(`Provider "${lastPrompt?.config?.provider}" not found`);
		}

		const capabilities = await ClientCapabilityService.getCapabilities({
			client,
			user: context.user,
			chat,
			message: prompt,
			messages: context.messages,
			providers,
			incognito: chat.incognito,
			temporary: chat.temporary,
			skills,
			mcpTools,
		});

		let toolsets = [
			...mcpTools,
			...(await ToolService.getTools({
				capabilities,
			})),
		];
		if (toolNames) {
			toolsets = toolsets
				.map((toolset) => ({
					...toolset,
					tools: toolset.tools.filter((tool) => toolNames.includes(tool.name)),
				}))
				.filter((toolset) => toolset.tools.length > 0);
		}

		const abort = AgentStreamService.start(streamKey, {
			chat: streamChat,
			initial: {
				data: [...data],
			},
		});

		AgentStreamService.mutate(streamKey, {
			mode: "patch",
			data: { status: "pending" },
		});

		const agent = AgentService.generate({
			provider,
			context,
			capabilities,
			toolsets,
			skills,
			data,
			metadata,
			instructions,
			env: client.providerEnv,
			options: {
				abortSignal: abort.signal,
				experimental_transform: [smoothStream({ delayInMs: 20 })],
			},
			interjections: streamChat
				? () => useMessageQueueStore.getState().drain(streamChat)
				: undefined,
			toolStream: ({ part, mutation }) => {
				if (!ToolStreamService.get(part.id)) {
					ToolStreamService.start(part.id);
				}
				ToolStreamService.mutate(part.id, mutation);
			},
		});

		for await (const event of agent) {
			if (event.type === "data") {
				if (event.value.type === "text" || event.value.type === "json") {
					AgentStreamService.mutate(streamKey, {
						mode: "patch",
						data: { status: "generating" },
					});
				} else if (event.value.type === "thought") {
					AgentStreamService.mutate(streamKey, {
						mode: "patch",
						data: { status: "thinking" },
					});
				} else if (event.value.type === "toolResult") {
					ToolStreamService.clear(event.value.id);
				}
			}

			AgentStreamService.mutate(streamKey, { mode: "patch", data: { data } });
		}

		return { data, metadata };
	},

	runTool: async ({
		client,
		user,
		chat,
		part,
		feedback,
		message,
		messages,
		skills,
		mcpTools,
		interactive,
	}: {
		client: Client;
		user: zUser;
		chat: ChatState;
		part: zToolCallPart;
		feedback: unknown;
		message: MessageState;
		messages: MessageState[];
		skills: zSkill[];
		mcpTools: Toolset<any>[];
		interactive: boolean;
	}): Promise<zToolResultPart> => {
		console.log("[ClientAgentService] running tool", part, feedback);

		const capabilities = await ClientCapabilityService.getCapabilities({
			client,
			user,
			chat,
			message,
			messages,
			incognito: chat.incognito,
			temporary: chat.temporary,
			skills,
			mcpTools,
		});

		const toolsets = await ToolService.getTools({
			capabilities,
		});

		const { tool } = ToolUtils.find({ toolsets, part });
		if (!tool) throw new Error("missing tool");

		try {
			ToolStreamService.start(part.id);

			const output = await tool.execute({
				input: part.input,
				feedback,
				stream: (mutation) => {
					ToolStreamService.mutate(part.id, mutation);
				},
				context: {
					user,
					chat,
					messages,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					interactive,
				},
			});

			return {
				type: "toolResult",
				id: part.id,
				name: part.name,
				error: false,
				output: output.map((value) => ({
					...value,
					id: CommonUtils.getRandomId(),
				})),
			};
		} catch (error) {
			return {
				type: "toolResult",
				id: part.id,
				name: part.name,
				error: true,
				output: [
					{
						type: "text",
						value: CommonUtils.formatError({ error, details: true }),
						id: CommonUtils.getRandomId(),
					},
				],
			};
		} finally {
			ToolStreamService.clear(part.id);
		}
	},
} as const;
