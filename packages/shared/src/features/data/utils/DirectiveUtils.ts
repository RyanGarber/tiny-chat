import { CommonUtils } from "../../../core/utils/CommonUtils.ts";

interface Directive<T extends string[]> {
	type: "container" | "leaf" | "inline";
	tag: T[number];
	depth?: number;
	attributes: Record<string, string>;
	content?: DirectiveMatch<T>[];
	textContent?: string;
}

export interface DirectiveMatch<T extends string[]> {
	text: string;
	directive?: Directive<T>;
}

export const DirectiveUtils = {
	/**
	 * Extract directives from a Markdown string.
	 */
	extractFromMarkdown: <T extends string[]>(
		input: string | { text: string; depth: number },
		...directives: T
	): DirectiveMatch<T>[] => {
		const text = typeof input === "string" ? input : input.text;
		const depth = typeof input === "string" ? 0 : input.depth;

		if (!directives.length) return [{ text }];

		const tagAlternation = directives
			.map(CommonUtils.getRegexEscaped)
			.join("|");
		const directiveRegex = new RegExp(
			`^(:{${3 + depth}})(${tagAlternation})(?:\\{([^}]*)\\})?([\\s\\S]*?)\\1` +
				`|^::(${tagAlternation})(?:\\[([^\\]]*)\\])?(?:\\{([^}]*)\\})?` +
				`|:(${tagAlternation})\\[([^\\]]*)\\](?:\\{([^}]*)\\})?`,
			"gm",
		);

		let cursor = 0;
		const result: DirectiveMatch<T>[] = [];
		let match: RegExpExecArray | null;

		while (true) {
			cursor = directiveRegex.lastIndex;
			match = directiveRegex.exec(text);
			if (!match) break;

			const [
				raw,
				_fence,
				containerTag,
				containerAttributes,
				containerContent,
				leafTag,
				leafContent,
				leafAttributes,
				inlineTag,
				inlineContent,
				inlineAttributes,
			] = match;

			const type = containerTag ? "container" : leafTag ? "leaf" : "inline";
			const tag = containerTag ?? leafTag ?? inlineTag;
			const attributes = CommonUtils.toAttributesObject(
				containerAttributes ?? leafAttributes ?? inlineAttributes,
			);
			const textContent = containerContent ?? leafContent ?? inlineContent;

			if (directives.includes(tag)) {
				if (cursor !== match.index) {
					result.push({ text: text.slice(cursor, match.index) });
				}

				const content: DirectiveMatch<T>[] =
					type === "container"
						? DirectiveUtils.extractFromMarkdown(
								{ text: textContent, depth: depth + 1 },
								...directives,
							)
						: [{ text: textContent }];

				result.push({
					text: raw,
					directive: { type, tag, depth, attributes, content, textContent },
				});
			}
		}

		if (cursor !== text.length) {
			result.push({ text: text.slice(cursor) });
		}

		return result;
	},

	/**
	 * Extract directives from an HTML string.
	 */
	extractFromHtml: <T extends string[]>(
		input: string | { text: string; depth: number },
		...directives: T
	): DirectiveMatch<T>[] => {
		const text = typeof input === "string" ? input : input.text;
		const depth = typeof input === "string" ? 0 : input.depth;

		if (!directives.length) return [{ text }];

		const tagAlternation = directives
			.map(CommonUtils.getRegexEscaped)
			.join("|");
		const openTagRegex = new RegExp(
			`<(${tagAlternation})((?:\\s+[\\w-]+="[^"]*")*)\\s*(/?)>`,
			"g",
		);

		let cursor = 0;
		const result: DirectiveMatch<T>[] = [];
		let match: RegExpExecArray | null;

		while (true) {
			match = openTagRegex.exec(text);
			if (!match) break;

			const [openRaw, openTag, openAttributes, openLeaf] = match;
			const openStart = match.index;
			const openEnd = openStart + openRaw.length;

			let close: ReturnType<typeof DirectiveUtils.getClosingTag> = null;
			let textContent: string | undefined;

			if (!openLeaf) {
				close = DirectiveUtils.getClosingTag({
					text,
					tag: openTag,
					start: openEnd,
				});
				if (!close) continue;
				textContent = text.slice(openEnd, close.start);
			}

			if (cursor !== openStart) {
				result.push({ text: text.slice(cursor, openStart) });
			}

			const type = openLeaf
				? "leaf"
				: textContent?.includes("\n")
					? "container"
					: "inline";
			const attributes = CommonUtils.toAttributesObject(openAttributes);

			const content =
				type === "container"
					? DirectiveUtils.extractFromHtml(
							{ text: textContent ?? "", depth: depth + 1 },
							...directives,
						)
					: [{ text: textContent ?? "" }];

			result.push({
				text: text.slice(
					openStart,
					openStart +
						openRaw.length +
						(textContent?.length ?? 0) +
						(close?.raw.length ?? 0),
				),
				directive: {
					type,
					tag: openTag,
					depth,
					attributes,
					content,
					textContent,
				},
			});

			cursor = close?.end ?? openEnd;
			openTagRegex.lastIndex = cursor;
		}

		if (cursor !== text.length) {
			result.push({ text: text.slice(cursor) });
		}
		return result;
	},

	/**
	 * Get the closing tag for a given opening tag.
	 */
	getClosingTag: ({
		text,
		tag,
		start,
	}: {
		text: string;
		tag: string;
		start: number;
	}) => {
		const escapedName = CommonUtils.getRegexEscaped(tag);
		const tagRegex = new RegExp(
			`<${escapedName}(?:\\s[^>]*)?>|<\\/${escapedName}>`,
			"g",
		);
		tagRegex.lastIndex = start;

		let depth = 1;
		let match: RegExpExecArray | null;
		while (true) {
			match = tagRegex.exec(text);
			if (!match) break;
			if (match[0].startsWith("</")) {
				depth--;
				if (depth === 0) {
					return { raw: match[0], start: match.index, end: tagRegex.lastIndex };
				}
			} else {
				depth++;
			}
		}
		return null;
	},

	/**
	 * Convert directives from HTML to Markdown.
	 */
	convertToMarkdown: (
		matches: DirectiveMatch<any>[],
		...directives: string[]
	): string => {
		return matches
			.map(({ text, directive }) => {
				if (!directive) return text;
				let attributesString = CommonUtils.toAttributesString(
					directive.attributes,
				);
				if (attributesString) attributesString = `{${attributesString}}`;
				if (directive.type === "container") {
					const contentString = DirectiveUtils.convertToMarkdown(
						directive.content ?? [],
						...directives,
					);
					return `:::${":".repeat(directive.depth ?? 0)}${directive.tag}${attributesString}${contentString}:::`;
				} else {
					const contentString = directive.textContent
						? `[${directive.textContent}]`
						: "";
					return directive.type === "leaf"
						? `::${directive.tag}${contentString}${attributesString}`
						: `:${directive.tag}${contentString}${attributesString}`;
				}
			})
			.join("");
	},

	/**
	 * Convert directives from Markdown to HTML.
	 */
	convertToHtml: (
		matches: DirectiveMatch<any>[],
		...directives: string[]
	): string => {
		return matches
			.map(({ text, directive }) => {
				if (!directive) return text;
				let attributesString = CommonUtils.toAttributesString(
					directive.attributes,
				);
				if (attributesString) attributesString = ` ${attributesString}`;
				if (directive.content) {
					const contentString = DirectiveUtils.convertToHtml(
						directive.content,
						...directives,
					);
					return `<${directive.tag}${attributesString}>${contentString}</${directive.tag}>`;
				} else {
					return `<${directive.tag}${attributesString} />`;
				}
			})
			.join("");
	},
} as const;
