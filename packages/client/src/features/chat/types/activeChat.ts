export type ProjectRef = { id: string; title: string | null };

/** What a loaded chat says about where it is. */
export type ChatPlacement = {
	id: string;
	projectId: string | null;
	project?: { title: string | null } | null;
};

/** How a chat that does not exist yet will be created. */
export type NewChatOptions = { temporary: boolean; incognito: boolean };

/**
 * The chat the app is on, and the project it is in. Either a new chat, which
 * sending creates in `project` with its options, or one that exists, whose
 * branch selection and focus go with it when it is left.
 */
export type ActiveChat =
	| ({
			status: "new";
			chatId: null;
			project: ProjectRef | null;
	  } & NewChatOptions)
	| {
			status: "open";
			chatId: string;
			/** The open chat's project: the one it opened from until it loads. */
			project: ProjectRef | null;
			branches: Record<string, string>;
			/** A message the chat should bring into view, once it is drawn. */
			focusedMessage: string | null;
	  };
