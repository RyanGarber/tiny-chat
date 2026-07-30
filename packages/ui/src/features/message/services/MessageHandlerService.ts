import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService";
import { smoothStream } from "ai";
import { AgentService } from "#core/features/agent/services/AgentService.ts";
import type {
	zAgentContext,
	zAgentMessage,
} from "#core/features/agent/types/agent.ts";
import { AgentUtils } from "#core/features/agent/utils/AgentUtils.ts";
import type { ChatState } from "#core/features/data/types/chat";
import {
	Author,
	type MessageState,
	type zData,
	type zDataPart,
	type zMetadata,
} from "#core/features/data/types/message";
import type { zUser } from "#core/features/data/types/user.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";
import type { zSkill } from "#core/features/skill/types/skill.ts";
import type { Toolset } from "#core/features/tool/types/tool.ts";
import { client } from "#ui/client.ts";
import { ClientCapabilityService } from "#ui/features/capability/services/ClientCapabilityService.ts";
import { refetchActions } from "#ui/features/chat/hooks/useActions.ts";
import { refetchChatList } from "#ui/features/chat/hooks/useChatList.ts";
import { refetchMemories } from "#ui/features/chat/hooks/useMemories.ts";
import { fetchNextEmbeddingBatch } from "#ui/features/config/hooks/useEmbedding.ts";
import { ProviderService } from "#ui/features/config/services/ProviderService.ts";
import { refetchMessages } from "#ui/features/message/hooks/useMessages.ts";
import {
	type Stream,
	StreamService,
} from "#ui/features/message/services/StreamService.ts";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";
import { isMissingToolResult } from "#ui/utils/data.ts";

export const MessageHandlerService = {
	/**
	 * Trigger model generation for an existing user message. If `message` is a
	 * model reply, the seed user message is resolved automatically. When
	 * `append` is provided (e.g. a user-supplied tool result), it is appended
	 * to the last data slot of the reply before generation continues.
	 */
	handle: async ({
		user,
		message,
		chat,
		append,
		mcpTools,
		providers,
		skills,
	}: {
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

		const { reply, messages } = await MessageHandlerService._prepare(
			seed,
			chat,
			append,
		);

		if (isMissingToolResult(reply.message)) {
			// Awaiting more user tool inputs — do not start generation yet.
			return;
		}

		void MessageHandlerService._generate({
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

		await refetchMessages(seed.chatId);

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
		user,
		context,
		skills,
		chat,
		seed,
		mcpTools,
		providers,
		stream,
	}: {
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

		const modelProviders = await ProviderService.getModelProviders(user);
		const provider = modelProviders.find(
			(p) => p.name === stream.message.config.provider,
		);
		if (!provider)
			throw new Error(`Provider "${stream.message.config.provider}" not found`);

		const capabilities = await ClientCapabilityService.getCapabilities({
			user,
			chat,
			message: seed,
			desktop: await TauriUtils.isTauriDesktop(),
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

		let rafId: number | null = null;
		const scheduleApply = (apply?: (m: MessageState) => void) => {
			if (rafId) {
				return;
			}
			rafId = requestAnimationFrame(() => {
				stream.apply(apply);
				rafId = null;
			});
		};

		for await (const event of agent) {
			scheduleApply((m) => {
				if (event.type === "data") {
					if (event.value.type === "text" || event.value.type === "json") {
						m.state.thinking = false;
						m.state.generating = true;
					} else if (event.value.type === "thought") {
						m.state.thinking = true;
					}
				}
			});
		}

		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}

		stream.apply((m) => {
			m.state.any = false;
			m.state.thinking = false;
			m.state.generating = false;
		});

		await MessageHandlerService._finalize(stream);
		StreamService.stop(stream.id);
	},

	/** Persist the final reply state to the server. */
	_finalize: async (stream: Stream): Promise<void> => {
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
		await refetchChatList();
		await refetchMessages(message.chatId);
		void refetchActions();
		void refetchMemories();
		void fetchNextEmbeddingBatch();
	},

	/** Abort a single in-flight stream. */
	abort: async (streamId: string): Promise<void> => {
		console.log("[MessageHandlerService] aborting stream", streamId);
		const stream = StreamService.get(streamId);
		if (stream) {
			await MessageHandlerService._finalize(stream);
			stream.abort.abort();
			StreamService.stop(streamId);
		}
	},
} as const;
