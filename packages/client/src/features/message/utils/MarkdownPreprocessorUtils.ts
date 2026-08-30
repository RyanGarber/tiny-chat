const BLOCKQUOTE = /^[\t ]{0,3}>/;
const BLANK = /^[\t ]*$/;
const FENCE_OPEN = /^[\t ]{0,3}(`{3,}|~{3,})/;

export const MarkdownPreprocessorUtils = {
	/**
	 * End explicitly marked blockquotes before an unmarked line so CommonMark's
	 * lazy-continuation rule cannot pull that line into the quote.
	 */
	preprocess: (markdown: string): string => {
		const lines = markdown.split(/(\r?\n)/);
		let fence: { marker: "`" | "~"; length: number } | undefined;

		for (let index = 0; index < lines.length; index += 2) {
			const line = lines[index];
			const fenceMatch = line.match(FENCE_OPEN);

			if (fence) {
				if (
					fenceMatch?.[1][0] === fence.marker &&
					fenceMatch[1].length >= fence.length &&
					line.slice((fenceMatch.index ?? 0) + fenceMatch[0].length).trim() ===
						""
				) {
					fence = undefined;
				}
				continue;
			}

			if (fenceMatch) {
				fence = {
					marker: fenceMatch[1][0] as "`" | "~",
					length: fenceMatch[1].length,
				};
				continue;
			}

			const separator = lines[index + 1];
			const next = lines[index + 2];
			if (
				separator &&
				next !== undefined &&
				BLOCKQUOTE.test(line) &&
				!BLOCKQUOTE.test(next) &&
				!BLANK.test(next)
			) {
				lines[index + 1] = separator + separator;
			}
		}

		return lines.join("");
	},
} as const;
