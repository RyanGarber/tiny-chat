import type { MessageState, zData, zDataPart } from "../types/message.ts";

export type RenderedPart =
	| Exclude<zDataPart, { type: "thought" | "toolCall" | "toolResult" }>
	| (Extract<zDataPart, { type: "thought" }> & { active: boolean })
	| (Extract<zDataPart, { type: "toolCall" }> & {
			result?: Extract<zDataPart, { type: "toolResult" }>;
	  });

export type RenderedPartGroup<T extends RenderedPart["type"][]> = {
	type: "group";
	value: Extract<RenderedPart, { type: T[number] }>[];
};

export const DataUtils = {
	getText: ({ data, join = " " }: { data: zData; join?: string }): string => {
		return data
			.flat()
			.filter((p) => p.type === "text")
			.map((p) => p.value)
			.join(join);
	},

	getTextCleaned: ({
		data,
		maxLength = -1,
	}: {
		data: zData | string;
		maxLength?: number;
	}) => {
		if (typeof data !== "string") data = DataUtils.getText({ data });
		data = data
			.replace(/^[\s\n]*<message[^>]*>[\s\n]*|[\s\n]*<\/message>[\s\n]*$/g, "")
			.replace(/(:+)[a-zA-Z0-9-]+(?:\[.*?])?(?:{.*?})?([.\n]*)\1?/g, "$2") // Remove directives
			.replace(/!\[.*?]\(.*?\)/g, "") // Remove images
			.replace(/\[([^\]]+)]\((.*?)\)/g, "$1") // Remove links but keep text
			.replace(/(`{1,3})(.*?)\1/g, "$2") // Remove inline code and code blocks
			.replace(/(\*\*|__)(.*?)\1/g, "$2") // Remove bold
			.replace(/([*_])(.*?)\1/g, "$2") // Remove italics
			.replace(/~~(.*?)~~/g, "$1") // Remove strikethrough
			.replace(/^[\s#>*-]*#+\s+(.*)/g, "$1") // Remove headings
			.replace(/^[\s#>*-]*>\s+(.*)/g, "$1") // Remove blockquotes
			.replace(/^[\s#>*-]*[*-]\s+(.*)/g, "$1") // Remove unordered list markers
			.replace(/^[\s#>*-]*\d+\.\s*(.*)/g, "$1") // Remove ordered list markers
			.replace(/\n/g, " ") // Replace multiple newlines with a single newline
			.trim();
		if (maxLength > 0 && data.length > maxLength) {
			return `${data.substring(0, maxLength)}...`;
		}
		return data;
	},

	isMissingToolResult: ({ data }: { data: zData }) => {
		const parts = data.flat();
		const toolCallCount = parts.filter((p) => p.type === "toolCall").length;
		const toolResultCount = parts.filter((p) => p.type === "toolResult").length;
		return toolResultCount < toolCallCount;
	},

	getRenderedParts: (message: MessageState) => {
		const parts = message.data.flat();
		const renderedParts: RenderedPart[] = [];

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];

			if (part.type === "text") {
				if (part.value.trim().length) renderedParts.push(part);
			} else if (part.type === "thought") {
				renderedParts.push({
					...part,
					active: message.state.thinking && i === parts.length - 1,
				});
			} else if (part.type === "toolCall") {
				renderedParts.push({
					...part,
					result: parts.find(
						(p): p is Extract<zDataPart, { type: "toolResult" }> =>
							p.type === "toolResult" && p.id === part.id,
					),
				});
			} else if (part.type === "toolResult") {
				// skip
			} else {
				renderedParts.push(part);
			}
		}

		return renderedParts;
	},

	/**
	 * Groups parts into renderable chunks with additional UI state.
	 */
	getRenderedPartsGrouped: <T extends RenderedPart["type"][]>(
		message: MessageState,
		...groups: T
	): (RenderedPart | RenderedPartGroup<T>)[] => {
		const parts = DataUtils.getRenderedParts(message);
		const renderedParts: (RenderedPart | RenderedPartGroup<T>)[] = [];

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];

			if (DataUtils.isGroupedPart(part, groups)) {
				const group: RenderedPartGroup<T> = { type: "group", value: [part] };
				let end = i;
				while (end < parts.length - 1) {
					const nextPart = parts[end + 1];
					if (!DataUtils.isGroupedPart(nextPart, groups)) break;
					group.value.push(nextPart);
					end++;
				}
				renderedParts.push(group);
				i = end;
			} else {
				renderedParts.push(part);
			}
		}

		return renderedParts;
	},

	isGroupedPart: <T extends RenderedPart["type"][]>(
		part: RenderedPart,
		groups: T,
	): part is Extract<RenderedPart, { type: T[number] }> => {
		return (groups as readonly string[]).includes(part.type);
	},
} as const;
