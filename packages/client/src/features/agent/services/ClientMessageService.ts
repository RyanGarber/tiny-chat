import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import {
	Author,
	type MessageState,
	type zData,
	type zDataPart,
	type zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import type { Client } from "../../../client.ts";
import { AgentStreamService } from "../../../core/services/StreamService.ts";
import { ChatService } from "../../chat/services/ChatService.ts";
import { UserService } from "../../user/services/UserService.ts";
import { ClientAgentService } from "./ClientAgentService.ts";

/**
 * Agent orchestration for messages.
 */
export const ClientMessageService = {
	/**
	 * Trigger model generation for an existing user message. If `message` is a
	 * model reply, the seed user message is resolved automatically. When
	 * `append` is provided (e.g. a user-supplied tool result), it is appended
	 * to the last data slot of the reply before generation continues.
	 */
	onMessage: async ({
		client,
		user,
		message,
		chat,
		append,
		mcpTools,
		providers,
		skills,
	}: {
		client: Client;
		user: zUser;
		message: MessageState;
		chat: ChatState;
		providers: ProviderState<ProviderStatus>[];
		skills: zSkill[];
		mcpTools: Toolset<any>[];
		append?: zDataPart[];
	}): Promise<void> => {
		console.log(
			"[ClientMessageService] handling model message",
			message,
			chat,
			append,
		);

		if (!mcpTools) {
			console.warn(`[ClientMessageService] continuing with no mcp tool data`);
			mcpTools = [];
		}

		let prompt: MessageState | undefined = message;
		if (message.author === Author.MODEL) {
			const { messages } = await client.api.message.getMessages.query({
				chat,
			});
			prompt = messages.find((m) => m.id === message.previousId);
		}
		if (!prompt) {
			throw new Error(`Could not find prompt (user) message for ${message.id}`);
		}

		const { response, messages } = await ClientMessageService._prepare(
			client,
			prompt,
			chat,
			append,
		);

		if (DataUtils.isMissingToolResult(response)) {
			// Awaiting more user tool inputs — do not start generation yet.
			return;
		}

		void (async () => {
			try {
				Object.assign(
					response,
					await ClientAgentService.runAgent({
						client,
						data: response.data,
						metadata: response.metadata,
						context: {
							user,
							chat,
							messages,
							timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
							interactive: true,
						},
						chat,
						prompt,
						mcpTools,
						providers,
						skills,
						streamKey: response.id,
						streamChat: chat.id,
					}),
				);
				await ClientMessageService._finalize(client, response);
			} finally {
				// After persist+refetch so the list still has the live overlay
				// while the infinite query is in flight.
				AgentStreamService.clear(response.id);
			}
		})();
	},

	/** Find or create the model reply and start a stream for it. */
	_prepare: async (
		client: Client,
		prompt: MessageState,
		chat: ChatState,
		append?: zDataPart[],
	): Promise<{ response: MessageState; messages: zAgentMessage[] }> => {
		console.log(
			"[ClientMessageService] preparing response",
			prompt,
			chat,
			append,
		);
		// Fetch full message list once so we can both locate the existing response
		// and build the generation context from a single source of truth.
		const { messages } = await client.api.message.getMessages.query({
			chat: prompt.chatId,
		});
		const existing = messages.find((m) => m.previousId === prompt.id);

		let response: MessageState;
		if (existing) {
			let data: zData = [];
			let metadata: zMetadata = [];
			if (append) {
				data = existing.data.map((d, i) =>
					i === existing.data.length - 1
						? AgentUtils.getToolResultsSorted({ data: [...d, ...append] })
						: d,
				);
				metadata = [...existing.metadata];
			}
			const edited = await client.api.message.updateMessage.mutate({
				message: existing.id,
				config: prompt.config,
				author: existing.author,
				data,
				metadata,
				truncate: false,
			});
			response = { ...edited };
		} else {
			const created = await client.api.message.createMessage.mutate({
				chat: prompt.chatId,
				author: Author.MODEL,
				config: prompt.config,
				metadata: [],
				data: [],
				previous: prompt.id,
				temporary: chat.temporary,
			});
			response = { ...created };
		}

		await ChatService.fetchMessages({ client, chatId: prompt.chatId });

		// Re-fetch to ensure the context reflects the inserted/edited reply.
		const { messages: updatedMessages } =
			await client.api.message.getMessages.query({
				chat: prompt.chatId,
			});
		const responseIndex = updatedMessages.findIndex(
			(m) => m.id === response.id,
		);
		const responseRef =
			responseIndex >= 0 ? updatedMessages[responseIndex] : response;

		return {
			response: responseRef,
			messages: updatedMessages
				.slice(
					0,
					(responseIndex >= 0 ? responseIndex : updatedMessages.length) + 1,
				)
				.map(
					(message): zAgentMessage => ({
						id: message.id,
						author: message.author,
						data: message.data,
						config: message.config,
						createdAt: message.createdAt,
					}),
				),
		};
	},

	/** Persist the final reply state to the server. */
	_finalize: async (client: Client, response: MessageState): Promise<void> => {
		console.log("[ClientMessageService] finalizing", response);
		await client.api.message.updateMessage.mutate({
			message: response.id,
			author: response.author,
			config: response.config,
			data: response.data,
			metadata: response.metadata,
			truncate: false,
		});
		console.log("[ClientMessageService] saved to chat, refetching");
		await ChatService.fetchChatList({ client });
		await ChatService.fetchMessages({ client, chatId: response.chatId });
		void UserService.fetchActions({ client });
		void UserService.fetchMemories({ client });
		void UserService.fetchNextEmbeddingBatch({ client });
	},
} as const;
