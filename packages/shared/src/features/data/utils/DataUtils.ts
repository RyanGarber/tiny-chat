import type { zData } from "../types/message.ts";

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
} as const;
