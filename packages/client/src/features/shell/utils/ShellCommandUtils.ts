/** What a line has to start with to be run in the shell rather than sent. */
const PREFIX = "!";

export const ShellCommandUtils = {
	PREFIX,

	/**
	 * The command written in the editor, when what is there is one: everything
	 * after a leading `!`, which may still be empty. Null for a message.
	 */
	parse: (text: string): string | null => {
		const trimmed = text.trimStart();
		if (!trimmed.startsWith(PREFIX)) return null;
		return trimmed.slice(PREFIX.length).trim();
	},
} as const;
