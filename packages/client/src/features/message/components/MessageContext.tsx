import type { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import {
	Author,
	type MessageState,
	type zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { search_web } from "@tiny-chat/core/src/features/tool/tools/web/search_web.ts";
import { view_web } from "@tiny-chat/core/src/features/tool/tools/web/view_web.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
} from "react";
import { ClientContext } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { AgentMessageService } from "../../agent/services/AgentMessageService.ts";
import { useChat } from "../../chat/hooks/useChat.ts";
import { useChatFiles } from "../../chat/hooks/useChatFiles.ts";
import { useThemes } from "../../settings/hooks/useThemes.ts";
import { useActions } from "../../user/hooks/useActions.ts";
import { useMemories } from "../../user/hooks/useMemories.ts";
import { useMessages } from "../hooks/useMessages.ts";
import type { MarkdownSource } from "./MarkdownContext.tsx";

export interface MessageContext {
	/** Citation targets, gathered once for the whole chat. */
	sources: MarkdownSource[];
	toolsets: Toolset<any>[];
	/** Ids of messages a later edit may have invalidated. */
	staleIds: Set<string>;
	/** Ids of tool calls that need feedback. */
	pendingFeedbackIds: string[];
	/** The ID of the next tool call that needs feedback. */
	nextFeedbackId: string | undefined;
	theme: (typeof ThemeUtils.themes)[number];
	/** Re-runs the agent for a message (retry / refresh after an edit). */
	retry: (message: MessageState) => void;
}

export const MessageContext = createContext<MessageContext>({
	sources: [],
	toolsets: [],
	staleIds: new Set(),
	pendingFeedbackIds: [],
	nextFeedbackId: undefined,
	theme: "light",
	retry: () => {},
});

/**
 * Holds everything the message list needs that is scoped to the *chat* rather
 * than to an individual message.
 *
 * These hooks used to be called inside `MessageBodyContent`, which mounts once
 * per message. That gave every message its own set of query observers, so any
 * query settling re-rendered the entire list, and each of those re-renders
 * rebuilt `sources` by walking every message again. Subscribing once here keeps
 * the per-message components memoizable and makes the walk O(n) for the list
 * instead of O(n) per message.
 */
export function MessageContextProvider({ children }: { children: ReactNode }) {
	const client = useContext(ClientContext);

	const { session } = useSession();
	const { chat } = useChat();
	const { theme } = useThemes();
	const { toolsets, mcpTools } = useTools();
	const { skills } = useSkills();
	const { memories } = useMemories();
	const { actions } = useActions();
	const { providers } = useProviders();
	const { messages } = useMessages();
	const { chatFiles } = useChatFiles();

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
					const input = ToolCallUtils.getDisplay({
						part,
						toolsets,
					});
					if (input) {
						pendingFeedbackIds.push(part.id);
						if (!nextFeedbackId) {
							nextFeedbackId = part.id;
						}
					}
				}
			}
		}
		return { pendingFeedbackIds, nextFeedbackId };
	}, [messageList, toolsets]);

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

	const value = useMemo(
		(): MessageContext => ({
			theme,
			sources,
			toolsets,
			staleIds,
			pendingFeedbackIds,
			nextFeedbackId,
			retry,
		}),
		[
			sources,
			toolsets,
			staleIds,
			theme,
			retry,
			pendingFeedbackIds,
			nextFeedbackId,
		],
	);

	return createElement(MessageContext, { value: value }, children);
}
