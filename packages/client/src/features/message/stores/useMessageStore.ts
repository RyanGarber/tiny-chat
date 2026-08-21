import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Source } from "@tiny-chat/core/src/features/data/utils/SourceUtils.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface MessageStore {
	/** True once every query the list depends on has settled at least once. */
	ready: boolean;
	/** Citation targets, gathered once for the whole chat. */
	sources: Source[];
	toolsets: Toolset<any>[];
	/** Ids of messages a later edit may have invalidated. */
	staleIds: Set<string>;
	/** Ids of tool calls that need feedback. */
	pendingFeedbackIds: string[];
	/** The id of the next tool call that needs feedback. */
	nextFeedbackId: string | undefined;
	/** Re-runs the agent for a message (retry / refresh after an edit). */
	retry: (message: MessageState) => void;
	publish: (next: MessageStoreValues) => void;
}

export type MessageStoreValues = Omit<MessageStore, "publish">;

const sameArray = (a: readonly unknown[], b: readonly unknown[]) =>
	a === b || (a.length === b.length && a.every((value, i) => value === b[i]));

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
	a === b || (a.size === b.size && [...a].every((value) => b.has(value)));

/**
 * Everything the message list needs that is scoped to the *chat* rather than to
 * an individual message.
 *
 * This used to be a React context. Every one of the nine queries behind it
 * produced a new context object as it settled, and a context change re-renders
 * every consumer regardless of which field it reads — so a chat cold-loading
 * re-rendered all mounted messages once per query. A store lets each consumer
 * subscribe to the one field it actually uses.
 *
 * `publish` keeps the previous reference whenever the incoming value is equal,
 * so recomputed-but-unchanged collections (notably `pendingFeedbackIds`, which
 * is rebuilt whenever the list or toolsets change) don't wake subscribers.
 */
export const createMessageStore = () =>
	createStore<MessageStore>((set) => ({
		ready: false,
		sources: [],
		toolsets: [],
		staleIds: new Set(),
		pendingFeedbackIds: [],
		nextFeedbackId: undefined,
		retry: () => {},

		publish: (next) =>
			set((state) => {
				const patch: Partial<MessageStore> = {};
				if (next.ready !== state.ready) patch.ready = next.ready;
				if (!sameArray(next.sources, state.sources))
					patch.sources = next.sources;
				if (!sameArray(next.toolsets, state.toolsets))
					patch.toolsets = next.toolsets;
				if (!sameSet(next.staleIds, state.staleIds))
					patch.staleIds = next.staleIds;
				if (!sameArray(next.pendingFeedbackIds, state.pendingFeedbackIds))
					patch.pendingFeedbackIds = next.pendingFeedbackIds;
				if (next.nextFeedbackId !== state.nextFeedbackId)
					patch.nextFeedbackId = next.nextFeedbackId;
				if (next.retry !== state.retry) patch.retry = next.retry;
				return patch;
			}),
	}));

/**
 * Stands in for components rendered outside a `MessageProvider` (previews,
 * tests) so reading the store is never a crash.
 */
const fallbackStore = createMessageStore();

export const MessageStoreContext =
	createContext<StoreApi<MessageStore>>(fallbackStore);

export function useMessageStore<T>(selector: (state: MessageStore) => T): T {
	return useStore(useContext(MessageStoreContext), selector);
}
