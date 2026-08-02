import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

marked.use(
	markedTerminal({
		emoji: true,
		showSectionPrefix: true,
		reflowText: false,
	}),
);

export const MarkdownUtils = {
	render: (source: string) => String(marked.parse(source, { gfm: true })),
} as const;
