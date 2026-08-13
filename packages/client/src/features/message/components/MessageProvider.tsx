import {
	Author,
	type MessageState,
	type zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { search_web } from "@tiny-chat/core/src/features/tool/tools/web/search_web.ts";
import { view_web } from "@tiny-chat/core/src/features/tool/tools/web/view_web.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import {
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { StoreApi } from "zustand/vanilla";
import { ClientContext } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { AgentMessageService } from "../../agent/services/AgentMessageService.ts";
import { useChat } from "../../chat/hooks/useChat.ts";
import { useChatFiles } from "../../chat/hooks/useChatFiles.ts";
import { useActions } from "../../user/hooks/useActions.ts";
import { useMemories } from "../../user/hooks/useMemories.ts";
import { useMessages } from "../hooks/useMessages.ts";
import {
	createMessageStore,
	type MessageStore,
	MessageStoreContext,
} from "../stores/useMessageStore.ts";
import type { MarkdownSource } from "./MarkdownContext.tsx";

/**
 * Runs the chat-scoped queries and pushes the result into the store.
 *
 * It is deliberately a sibling of `children` rather than their parent: query
 * settling re-renders this component, which renders nothing, instead of the
 * whole message list.
 */
function MessageSync({ store }: { store: StoreApi<MessageStore> }) {
	const client = useContext(ClientContext);

	const { session } = useSession();
	const { chat } = useChat();
	const { toolsets, mcpTools, nativeTools } = useTools();
	const { skills, localSkills, nativeSkills } = useSkills();
	const { memories } = useMemories();
	const { actions } = useActions();
	const { providers } = useProviders();
	const { messages } = useMessages();
	const { chatFiles } = useChatFiles();

	/**
	 * Hold everything back until the queries have settled, so a cold load
	 * publishes once instead of once per query.
	 *
	 * `isLoading` rather than `isPending`: a disabled query stays pending
	 * forever, which would never let the list through.
	 */
	const ready = ![
		session,
		chat,
		messages,
		memories,
		actions,
		providers,
		chatFiles,
		nativeTools,
		mcpTools,
		localSkills,
		nativeSkills,
	].some((query) => query.isLoading);

	const messageList = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages) ?? [],
		[messages.data],
	);

	const sources = useMemo((): MarkdownSource[] => {
		return [
			...messageList.flatMap((m) =>
				m.data
					.flat()
					.filter(
						(part): part is Extract<zDataPart, { type: "toolResult" }> =>
							part.type === "toolResult" && !part.error,
					)
					.flatMap((part): MarkdownSource[] => {
						const { tool } = ToolUtils.find({ toolsets, part });
						if (tool?.name === search_web.name) {
							const output = ToolUtils.json<typeof search_web>(part, true);
							return (
								output.map((value) => ({
									key: value.url,
									type: "web",
									value,
								})) ?? []
							);
						} else if (tool?.name === view_web.name) {
							const output = ToolUtils.json<typeof view_web>(part);
							return output[0]
								? [{ key: output[0].url, type: "web", value: output[0] }]
								: [];
						}
						return [];
					}),
			),
			...(memories.data?.map(
				(memory): MarkdownSource => ({
					key: memory.id,
					type: "memory",
					value: memory,
				}),
			) ?? []),
			...(actions.data?.map(
				(action): MarkdownSource => ({
					key: action.id,
					type: "action",
					value: action,
				}),
			) ?? []),
			...(chatFiles.data?.map(
				(file): MarkdownSource => ({
					key: file.uri,
					type: "file",
					value: file,
				}),
			) ?? []),
		];
	}, [messageList, toolsets, actions.data, chatFiles.data, memories.data]);

	/**
	 * A message is stale when an earlier model message carries a newer timestamp,
	 * which means the chat was edited above it. Tracking the newest timestamp
	 * seen so far settles the whole list in one pass.
	 */
	const staleIds = useMemo(() => {
		const stale = new Set<string>();
		let newestPrior = -Infinity;

		for (const message of messageList) {
			const createdAt = new Date(message.createdAt).getTime();
			if (newestPrior > createdAt) stale.add(message.id);
			if (message.author === Author.MODEL && createdAt > newestPrior) {
				newestPrior = createdAt;
			}
		}

		return stale;
	}, [messageList]);

	const { pendingFeedbackIds, nextFeedbackId } = useMemo(() => {
		const pendingFeedbackIds: string[] = [];
		let nextFeedbackId: string | undefined;
		for (const message of messageList) {
			const parts = DataUtils.getRenderedParts(message);
			for (const part of parts) {
				if (part.type === "toolCall" && !part.result) {
					pendingFeedbackIds.push(part.id);
					if (!nextFeedbackId) {
						nextFeedbackId = part.id;
					}
				}
			}
		}
		return { pendingFeedbackIds, nextFeedbackId };
	}, [messageList]);

	const retry = useCallback(
		(message: MessageState) => {
			if (!session.data || !chat.data || !providers.data) return;
			void AgentMessageService.handle({
				client,
				user: session.data.user,
				message,
				chat: chat.data,
				mcpTools: mcpTools.data,
				skills,
				providers: providers.data,
			});
		},
		[session.data, chat.data, providers.data, mcpTools.data, skills, client],
	);

	useEffect(() => {
		if (!ready) return;
		store.getState().publish({
			ready,
			sources,
			toolsets,
			staleIds,
			pendingFeedbackIds,
			nextFeedbackId,
			retry,
		});
	}, [
		store,
		ready,
		sources,
		toolsets,
		staleIds,
		pendingFeedbackIds,
		nextFeedbackId,
		retry,
	]);

	return null;
}

export function MessageProvider({ children }: { children: ReactNode }) {
	const [store] = useState(createMessageStore);

	return createElement(
		MessageStoreContext,
		{ value: store },
		createElement(MessageSync, { store, key: "sync" }),
		children,
	);
}
