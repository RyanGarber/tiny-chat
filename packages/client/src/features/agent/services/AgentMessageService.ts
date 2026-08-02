import { AgentService } from "@tiny-chat/core/src/features/agent/services/AgentService.ts";
import type {
	zAgentContext,
	zAgentMessage,
} from "@tiny-chat/core/src/features/agent/types/agent.ts";
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
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { smoothStream } from "ai";
import type { Client } from "../../../client.ts";
import { ClientCapabilityService } from "../../capability/services/ClientCapabilityService.ts";
import { ChatService } from "../../chat/services/ChatService.ts";
import {
	type Stream,
	StreamService,
} from "../../chat/services/StreamService.ts";
import { UserService } from "../../user/services/UserService.ts";
import { ProviderService } from "./ProviderService.ts";

/**
 * Agent orchestration for messages.
 */
export const AgentMessageService = {
	/**
	 * Trigger model generation for an existing user message. If `message` is a
	 * model reply, the seed user message is resolved automatically. When
	 * `append` is provided (e.g. a user-supplied tool result), it is appended
	 * to the last data slot of the reply before generation continues.
	 */
	handle: async ({
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
		mcpTools?: Toolset<any>[];
		providers: ProviderState<ProviderStatus>[];
		skills: zSkill[];
		append?: zDataPart[];
	}): Promise<void> => {
		console.log(
			"[MessageHandlerService] handling model message",
			message,
			chat,
			append,
		);

		if (!mcpTools) {
			console.warn(`[MessageHandlerService] continuing with no mcp tool data`);
			mcpTools = [];
		}

		let seed: MessageState | undefined = message;
		if (message.author === Author.MODEL) {
			const { messages } = await client.api.message.getMessages.query({
				chat,
			});
			seed = messages.find((m) => m.id === message.previousId);
		}
		if (!seed)
			throw new Error(`Could not find seed (user) message for ${message.id}`);

		const { reply, messages } = await AgentMessageService._prepare(
			client,
			seed,
			chat,
			append,
		);

		if (DataUtils.isMissingToolResult(reply.message)) {
			// Awaiting more user tool inputs — do not start generation yet.
			return;
		}

		void AgentMessageService._generate({
			client,
			user,
			stream: reply,
			context: {
				user,
				chat,
				messages,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
			chat,
			seed,
			mcpTools,
			providers,
			skills,
		});
	},

	/** Find or create the model reply and start a stream for it. */
	_prepare: async (
		client: Client,
		seed: MessageState,
		chat: ChatState,
		append?: zDataPart[],
	): Promise<{ reply: Stream; messages: zAgentMessage[] }> => {
		console.log("[MessageHandlerService] preparing reply", seed, chat, append);
		// Fetch full message list once so we can both locate the existing reply
		// and build the generation context from a single source of truth.
		const { messages } = await client.api.message.getMessages.query({
			chat: seed.chatId,
		});
		const existing = messages.find((m) => m.previousId === seed.id);

		let reply: MessageState;
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
				config: seed.config,
				author: existing.author,
				data,
				metadata,
				truncate: false,
			});
			reply = { ...edited };
		} else {
			const created = await client.api.message.createMessage.mutate({
				chat: seed.chatId,
				author: Author.MODEL,
				config: seed.config,
				metadata: [],
				data: [],
				previous: seed.id,
				temporary: chat.temporary,
			});
			reply = { ...created };
		}

		await ChatService.fetchMessages({ client, chatId: seed.chatId });

		// Re-fetch to ensure the context reflects the inserted/edited reply.
		const { messages: updatedMessages } =
			await client.api.message.getMessages.query({
				chat: seed.chatId,
			});
		const replyIndex = updatedMessages.findIndex((m) => m.id === reply.id);
		const replyRef = replyIndex >= 0 ? updatedMessages[replyIndex] : reply;

		// Mirror metadata onto the streaming snapshot so the controller can commit
		// it back at the end of the run.
		const stream = StreamService.start(replyRef);
		stream.apply((m) => {
			m.state.any = true;
		});

		return {
			reply: stream,
			messages: updatedMessages
				.slice(0, (replyIndex >= 0 ? replyIndex : updatedMessages.length) + 1)
				.map(
					(m): zAgentMessage => ({
						id: m.id,
						author: m.author,
						data: m.data,
						config: m.config,
						createdAt: m.createdAt,
					}),
				),
		};
	},

	/** Run the generation loop, pumping deltas into the stream registry. */
	_generate: async ({
		client,
		user,
		context,
		skills,
		chat,
		seed,
		mcpTools,
		providers,
		stream,
	}: {
		client: Client;
		user: zUser;
		context: zAgentContext;
		skills: zSkill[];
		chat: ChatState;
		seed: MessageState;
		mcpTools: Toolset<any>[];
		providers: ProviderState<ProviderStatus>[];
		stream: Stream;
	}): Promise<void> => {
		console.log(
			"[MessageHandlerService] generating",
			stream,
			context,
			skills,
			providers,
		);

		const modelProviders = await ProviderService.getModelProviders({
			client,
			user,
		});
		const provider = modelProviders.find(
			(p) => p.name === stream.message.config.provider,
		);
		if (!provider)
			throw new Error(`Provider "${stream.message.config.provider}" not found`);

		const capabilities = await ClientCapabilityService.getCapabilities({
			client,
			user,
			chat,
			message: seed,
			providers,
			incognito: chat.incognito,
		});

		const toolsets = [
			...mcpTools,
			...(await ToolService.getTools({
				capabilities,
				incognito: chat.incognito,
			})),
		];

		const agent = AgentService.generate({
			provider,
			context,
			capabilities,
			toolsets,
			skills,
			data: stream.message.data,
			metadata: stream.message.metadata,
			env: client.providerEnv,
			options: {
				abortSignal: stream.abort.signal,
				experimental_transform: [smoothStream({ delayInMs: 20 })],
			},
		});

		let lastNotifyAt = 0;

		for await (const event of agent) {
			if (event.type === "data") {
				if (event.value.type === "text" || event.value.type === "json") {
					stream.message.state.thinking = false;
					stream.message.state.generating = true;
				} else if (event.value.type === "thought") {
					stream.message.state.thinking = true;
				}
			}

			const now = Date.now();
			if (now - lastNotifyAt >= 1000 / 60) {
				lastNotifyAt = now;
				stream.apply();
			}
		}

		stream.apply((m) => {
			m.state.any = false;
			m.state.thinking = false;
			m.state.generating = false;
		});

		await AgentMessageService._finalize(client, stream);
		StreamService.stop(stream.id);
	},

	/** Persist the final reply state to the server. */
	_finalize: async (client: Client, stream: Stream): Promise<void> => {
		console.log("[MessageHandlerService] finalizing", stream);
		const { message } = stream;
		await client.api.message.updateMessage.mutate({
			message: message.id,
			author: message.author,
			config: message.config,
			data: message.data,
			metadata: message.metadata,
			truncate: false,
		});
		console.log("[MessageHandlerService] saved to chat, refetching");
		await ChatService.fetchChatList({ client });
		await ChatService.fetchMessages({ client, chatId: message.chatId });
		void UserService.fetchActions({ client });
		void UserService.fetchMemories({ client });
		void UserService.fetchNextEmbeddingBatch({ client });
	},

	/** Abort a single in-flight stream. */
	abort: async ({
		client,
		id,
	}: {
		client: Client;
		id: string;
	}): Promise<void> => {
		console.log("[MessageHandlerService] aborting stream", id);
		const stream = StreamService.get(id);
		if (stream) {
			await AgentMessageService._finalize(client, stream);
			stream.abort.abort();
			StreamService.stop(id);
		}
	},
} as const;
