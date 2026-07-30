import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { MarkdownToken, NodeConfig } from "@tiptap/react";

export interface InlineDirectiveOptions {
	/** The Tiptap node name this spec is for */
	nodeName: string;
	/** The markdown syntax name (defaults to nodeName if not provided) */
	name?: string;
	/** Default attributes to apply when parsing */
	defaultAttributes?: Record<string, any>;
}

/**
 * Create a CommonMark inline directive.
 * @example
 * :name[**Content**]{attribute="value"}
 */
export function createInlineDirective(
	options: InlineDirectiveOptions,
): Partial<NodeConfig<any, any>> {
	const { nodeName, name = nodeName, defaultAttributes = {} } = options;

	return {
		parseMarkdown(token, helpers) {
			const attrs = { ...defaultAttributes, ...token.attributes };

			return helpers.createNode(
				nodeName,
				attrs,
				helpers.parseInline(token.tokens ?? []),
			);
		},

		markdownTokenizer: {
			name: nodeName,
			level: "inline",
			start(src) {
				const regex = new RegExp(`:${name}\\[([^\\]]*)](?:{([^}]*)})?`);
				const match = src.match(regex);
				if (match?.index === undefined) return -1;

				return match.index;
			},
			tokenize(src, _tokens, lexer) {
				const regex = new RegExp(`^:${name}\\[([^\\]]*)](?:{([^}]*)})?`);
				const match = src.match(regex);
				if (!match) return undefined;

				const content = match[1].trim();
				const tokens = lexer.inlineTokens(content);
				const attributes = CommonUtils.toAttributesObject(
					match[2]?.trim() ?? "",
				);

				console.log(`[createInlineDirective] tokenize:`, {
					src,
					match,
					content,
					attributes,
					tokens,
				});
				return {
					type: nodeName,
					attributes,
					content: content.trim(),
					tokens,
					raw: match[0],
				};
			},
		},

		renderMarkdown(node, h) {
			const content = h.renderChildren(node.content ?? []);

			let attributes = CommonUtils.toAttributesString(node.attrs ?? {});
			if (attributes) attributes = `{${attributes}}`;

			return `:${name}[${content}]${attributes}`;
		},
	};
}

export interface ContainerDirectiveOptions {
	/** The Tiptap node name this spec is for */
	nodeName: string;
	/** The markdown syntax name (defaults to nodeName if not provided) */
	name?: string;
	/** Default attributes to apply when parsing */
	defaultAttributes?: Record<string, any>;
	/** Content type (default: block) */
	content?: "block" | "inline";
}

/** @lintignore */
export interface LeafDirectiveOptions {
	/** The Tiptap node name this spec is for */
	nodeName: string;
	/** The markdown syntax name (defaults to nodeName if not provided) */
	name?: string;
	/** Default attributes to apply when parsing */
	defaultAttributes?: Record<string, any>;
}

/** @lintignore */
export function createLeafDirective(
	options: LeafDirectiveOptions,
): Partial<NodeConfig<any, any>> {
	const { nodeName, name = nodeName, defaultAttributes = {} } = options;

	return {
		parseMarkdown(token, helpers) {
			const attrs = { ...defaultAttributes, ...token.attributes };

			return helpers.createNode(
				nodeName,
				attrs,
				helpers.parseInline(token.tokens ?? []),
			);
		},

		markdownTokenizer: {
			name: nodeName,
			level: "block",
			start(src) {
				const regex = new RegExp(`^::${name}(?:[[{\\s]|$)`, "m");
				const match = src.match(regex);
				if (match?.index === undefined) return -1;

				return match.index;
			},
			tokenize(src, _tokens, lexer) {
				const regex = new RegExp(`^::${name}(?:\\[([^\\]]*)])?(?:{([^}]*)})?`);
				const match = src.match(regex);
				if (!match) return undefined;

				const content = match[1]?.trim() ?? "";
				const tokens = lexer.inlineTokens(content);
				const attributes = CommonUtils.toAttributesObject(
					match[2]?.trim() ?? "",
				);

				return {
					type: nodeName,
					attributes,
					content: content.trim(),
					tokens,
					raw: match[0],
				};
			},
		},

		renderMarkdown(node, h) {
			let content = h.renderChildren(node.content ?? []);
			if (content) content = `[${content}]`;

			let attributes = CommonUtils.toAttributesString(node.attrs ?? {});
			if (attributes) attributes = `{${attributes}}`;

			return `::${name}${content}${attributes}`;
		},
	};
}

/**
 * Create a CommonMark container directive.
 * @example
 * :::name{attribute="value"}
 * **Content**
 * :::
 */
export function createContainerDirective(
	options: ContainerDirectiveOptions,
): Partial<NodeConfig<any, any>> {
	const {
		nodeName,
		name = nodeName,
		defaultAttributes = {},
		content = "block",
	} = options;

	return {
		parseMarkdown(token, helpers) {
			const attrs = { ...defaultAttributes, ...token.attributes };
			return helpers.createNode(
				nodeName,
				attrs,
				content === "block"
					? helpers.parseChildren(token.tokens ?? [])
					: helpers.parseInline(token.tokens ?? []),
			);
		},

		markdownTokenizer: {
			name: nodeName,
			level: "block",
			start(src) {
				const regex = new RegExp(`^:::${name}(?:[{\\s]|$)`, "m");
				const match = src.match(regex);
				if (match?.index === undefined) return -1;

				return match.index;
			},
			tokenize(src, _tokens, lexer) {
				const openingRegex = new RegExp(`^:::${name}(?:\\{([^}]*)})?\\s*\\n`);
				const openingMatch = src.match(openingRegex);
				if (!openingMatch) return undefined;

				const position = openingMatch[0].length;
				const attributes = CommonUtils.toAttributesObject(
					openingMatch[1] ?? "",
				);

				// Find the matching closing tag by tracking nesting level
				let level = 1;
				let matchedContent: string;

				// Regex to match any block opening (:::word) or closing (:::)
				const blockRegex = /^:::([\w-]*)((?:{|[^\S\n]).*)?/gm;
				const remaining = src.slice(position);

				blockRegex.lastIndex = 0;

				// run until no more matches are found
				while (true) {
					const match = blockRegex.exec(remaining);
					if (match === null) {
						break;
					}
					const matchPos = match.index;
					const blockType = match[1]; // Empty string for closing tag, block name for opening

					if (match[2]?.endsWith(":::")) {
						// this is an atom ::: node, we skip it
						continue;
					}

					if (blockType) {
						// Opening tag found - increase level
						level += 1;
					} else {
						// Closing tag found - decrease level
						level -= 1;

						if (level === 0) {
							// Found our matching closing tag
							// Don't trim yet - keep newlines for tokenizer regex matching
							const rawContent = remaining.slice(0, matchPos);
							matchedContent = rawContent.trim();
							const fullMatch = src.slice(
								0,
								position + matchPos + match[0].length,
							);

							// Tokenize the content
							let contentTokens: MarkdownToken[] = [];
							if (matchedContent) {
								if (content === "block") {
									// Use rawContent for tokenization to preserve line boundaries for regex matching
									contentTokens = lexer.blockTokens(rawContent);

									// Parse inline tokens for any token that has text content but no tokens
									contentTokens.forEach((token) => {
										if (
											token.text &&
											(!token.tokens || token.tokens.length === 0)
										) {
											token.tokens = lexer.inlineTokens(token.text);
										}
									});

									// Clean up empty trailing paragraphs
									while (contentTokens.length > 0) {
										const lastToken = contentTokens[contentTokens.length - 1];
										if (
											lastToken.type === "paragraph" &&
											(!lastToken.text || lastToken.text.trim() === "")
										) {
											contentTokens.pop();
										} else {
											break;
										}
									}
								} else {
									contentTokens = lexer.inlineTokens(matchedContent);
								}
							}

							return {
								type: nodeName,
								attributes,
								content: matchedContent,
								tokens: contentTokens,
								raw: fullMatch,
							};
						}
					}
				}

				// No matching closing tag found
				return undefined;
			},
		},

		renderMarkdown(node, h) {
			const content = h.renderChildren(node.content ?? [], "\n");

			let attributes = CommonUtils.toAttributesString(node.attrs ?? {});
			if (attributes) attributes = `{${attributes}}`;

			return `:::${name}${attributes}\n${content}\n:::`;
		},
	};
}
