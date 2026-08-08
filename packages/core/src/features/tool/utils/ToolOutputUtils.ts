/**
 * Every tool that can return an unbounded amount of text runs it through here
 * first. Keeping the head and the tail is deliberate: the head carries the
 * command's intent and the tail carries its outcome, and the part in between is
 * what an agent least often needs.
 */
export const ToolOutputUtils = {
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
} as const;
