import { ToolService } from "@tiny-chat/shared/src/features/tool/services/ToolService";
import { smoothStream } from "ai";
import { FrontendCapabilityService } from "#frontend/features/capability/services/FrontendCapabilityService.ts";
import { refetchActions } from "#frontend/features/chat/hooks/useActions.ts";
import { refetchChatList } from "#frontend/features/chat/hooks/useChatList.ts";
import { refetchMemories } from "#frontend/features/chat/hooks/useMemories.ts";
import { fetchNextEmbeddingBatch } from "#frontend/features/config/hooks/useEmbedding.ts";
import { ProviderService } from "#frontend/features/config/services/ProviderService.ts";
import { refetchMessages } from "#frontend/features/message/hooks/useMessages.ts";
import {
	type Stream,
	StreamService,
} from "#frontend/features/message/services/StreamService.ts";
import { env, isTauriDesktop, trpc } from "#frontend/utils/api.ts";
import { isMissingToolResult } from "#frontend/utils/data.ts";
import { AgentService } from "#shared/features/agent/services/AgentService.ts";
import type {
	zAgentContext,
	zAgentMessage,
} from "#shared/features/agent/types/agent.ts";
import { AgentUtils } from "#shared/features/agent/utils/AgentUtils.ts";
import type { ChatState } from "#shared/features/data/types/chat";
import {
	Author,
	type MessageState,
	type zData,
	type zDataPart,
	type zMetadata,
} from "#shared/features/data/types/message";
import type { zUser } from "#shared/features/data/types/user.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#shared/features/provider/types/provider.ts";
import type { zSkill } from "#shared/features/skill/types/skill.ts";
import type { Toolset } from "#shared/features/tool/types/tool.ts";

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
			const { messages } = await trpc.message.getMessages.query({
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
				supportsUserInput: true,
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
		const { messages } = await trpc.message.getMessages.query({
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
			const edited = await trpc.message.updateMessage.mutate({
				message: existing.id,
				config: seed.config,
				author: existing.author,
				data,
				metadata,
				truncate: false,
			});
			reply = { ...edited };
		} else {
			const created = await trpc.message.createMessage.mutate({
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
		const { messages: updatedMessages } = await trpc.message.getMessages.query({
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

		// TODO WIP - should probably get capabilities and tools here (and useToolInput) and use a shim elsewhere,
		//          - but that requires somehow making clear that the tools in useTools are 'fake' and will not run.
		//          - perhaps renaming it (useToolDefinitions?) and converting the tools to a non-runnable type?
		//          - for now, we'll just accept the hook's current value, because race conditions aside,
		//          - it might just work well enough. and it keeps data deduplicated and logic simpler.

		const capabilities = await FrontendCapabilityService.getCapabilities({
			user,
			chat,
			message: seed,
			desktop: await isTauriDesktop(),
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
			env,
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
		await trpc.message.updateMessage.mutate({
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
