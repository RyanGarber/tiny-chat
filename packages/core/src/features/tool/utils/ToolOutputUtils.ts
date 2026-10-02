/** Colour, cursor and title escapes: CSI, OSC, and the short two-byte kind. */
const ANSI =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: matching escapes is the point
	/\u001B\[[0-?]*[ -/]*[@-~]|\u001B][^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B[ -/]*[0-~]/g;

/**
 * Every tool that can return an unbounded amount of text runs it through here
 * first. Keeping the head and the tail is deliberate: the head carries the
 * command's intent and the tail carries its outcome, and the part in between is
 * what an agent least often needs.
 */
export const ToolOutputUtils = {
	/** Terminal output without its colour and cursor escapes, with `\n` lines. */
	stripAnsi: (text: string): string =>
		text.replace(ANSI, "").replace(/\r\n/g, "\n"),

	/**
	 * Terminal output as it last appeared: escapes removed, and each line
	 * reduced to what followed its last carriage return, which is how progress
	 * bars and spinners redraw themselves.
	 */
	getPlain: (text: string): string =>
		ToolOutputUtils.stripAnsi(text)
			.split("\n")
			.map((line) => line.slice(line.lastIndexOf("\r") + 1))
			.join("\n"),

	getBounded: ({
		text,
		maxChars = 20_000,
		maxLines = 300,
		label = "output",
	}: {
		text: string;
		maxChars?: number;
		maxLines?: number;
		label?: string;
	}): string => {
		if (!text) return text;

		const lines = text.split("\n");
		if (text.length <= maxChars && lines.length <= maxLines) return text;

		const headLines = Math.ceil(maxLines / 2);
		const tailLines = Math.floor(maxLines / 2);
		const head = lines
			.slice(0, headLines)
			.join("\n")
			.slice(0, maxChars / 2);
		const tail = lines
			.slice(Math.max(headLines, lines.length - tailLines))
			.join("\n")
			.slice(-maxChars / 2);

		const omitted = text.length - head.length - tail.length;
		if (omitted <= 0) return text;

		return `${head}\n\n[… ${omitted} characters of ${label} omitted; re-run against a narrower target to see them …]\n\n${tail}`;
	},

	/**
	 * Accumulates output as it arrives while holding only its head and tail, so
	 * a command that never stops writing (`find /`) cannot exhaust memory, or
	 * stall the thread that later has to bound it. Sized well above what
	 * `getBounded` keeps, so its cut is the one the model sees.
	 */
	collect: (limit = 256 * 1024) => {
		let head = "";
		let tail = "";
		let omitted = 0;
		return {
			push: (chunk: string) => {
				if (head.length < limit) {
					const room = limit - head.length;
					head += chunk.slice(0, room);
					chunk = chunk.slice(room);
					if (!chunk) return;
				}
				tail += chunk;
				if (tail.length > limit * 2) {
					omitted += tail.length - limit;
					tail = tail.slice(-limit);
				}
			},
			text: () => {
				if (!omitted) return head + tail;
				return `${head}\n[… ${omitted} characters omitted …]\n${tail}`;
			},
		};
	},
} as const;
