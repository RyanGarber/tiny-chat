import type {
	ActiveChat,
	ChatPlacement,
	NewChatOptions,
	ProjectRef,
} from "#client/features/chat/types/activeChat.ts";

const NO_BRANCHES: Record<string, string> = Object.freeze({}) as Record<
	string,
	string
>;

/**
 * Transitions of {@link ActiveChat}. Each returns the state it is given when
 * it does not apply, so a store can hand them anything.
 */
export const ActiveChatUtils = {
	/** A new chat in `project`, with no options set. */
	start: (project: ProjectRef | null): ActiveChat => ({
		status: "new",
		chatId: null,
		project,
		temporary: false,
		incognito: false,
	}),

	/** Opens a chat. Its project stays the current one until the chat loads. */
	open: (active: ActiveChat, chatId: string): ActiveChat =>
		active.chatId === chatId
			? active
			: {
					status: "open",
					chatId,
					project: active.project,
					branches: {},
					focusedMessage: null,
				},

	/** Follows the open chat into the project it turns out to be in. */
	load: (active: ActiveChat, chat: ChatPlacement): ActiveChat => {
		if (active.chatId !== chat.id) return active;
		const project = chat.projectId
			? { id: chat.projectId, title: chat.project?.title ?? null }
			: null;
		if (
			active.project?.id === project?.id &&
			active.project?.title === project?.title
		)
			return active;
		return { ...active, project };
	},

	setOptions: (
		active: ActiveChat,
		options: Partial<NewChatOptions>,
	): ActiveChat =>
		active.status === "new" ? { ...active, ...options } : active,

	selectBranch: (
		active: ActiveChat,
		parentId: string | null,
		messageId: string,
	): ActiveChat =>
		active.status === "open"
			? {
					...active,
					branches: { ...active.branches, [parentId ?? ""]: messageId },
				}
			: active,

	/** Selects the branches that lead to a message and asks for it to be shown. */
	focus: (
		active: ActiveChat,
		messageId: string,
		branches: Record<string, string>,
	): ActiveChat =>
		active.status === "open"
			? { ...active, branches, focusedMessage: messageId }
			: active,

	clearFocus: (active: ActiveChat): ActiveChat =>
		active.status === "open" && active.focusedMessage
			? { ...active, focusedMessage: null }
			: active,

	/** The branches selected in `chatId`, if it is the open chat. */
	branches: (active: ActiveChat, chatId = active.chatId) =>
		active.status === "open" && active.chatId === chatId
			? active.branches
			: NO_BRANCHES,

	/** The options a new chat would be created with; none for an open one. */
	options: (active: ActiveChat): NewChatOptions =>
		active.status === "new"
			? { temporary: active.temporary, incognito: active.incognito }
			: { temporary: false, incognito: false },
} as const;
