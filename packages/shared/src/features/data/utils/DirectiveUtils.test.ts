import { describe, expect, it } from "vitest";
import { type DirectiveMatch, DirectiveUtils } from "./DirectiveUtils.ts";

function clean(matches: DirectiveMatch<any>[]) {
	return matches.map((m) =>
		m.directive
			? {
					directive: {
						type: m.directive.type,
						tag: m.directive.tag,
						attributes: m.directive.attributes,
						content: m.directive.content,
					} satisfies Partial<DirectiveMatch<any>["directive"]>,
				}
			: { text: m.text },
	);
}

describe("DirectiveUtils", () => {
	const INLINE_XML =
		'In a paragraph, <cite sources="action:123">inline citations exist</cite>.';
	const INLINE_MARKDOWN =
		'In a paragraph, :cite[inline citations exist]{sources="action:123"}.';

	it("extracts inline directives", () => {
		const htmlExtract = DirectiveUtils.extractFromHtml(INLINE_XML, "cite");
		const markdownExtract = DirectiveUtils.extractFromMarkdown(
			INLINE_MARKDOWN,
			"cite",
		);

		expect(clean(htmlExtract)).toEqual(clean(markdownExtract));
	});

	const BLOCK_HTML =
		'<quote model="gpt-5.5">\nSome quote from chat gippity,\nwith multiple lines.\n</quote>';
	const BLOCK_MARKDOWN =
		':::quote{model="gpt-5.5"}\nSome quote from chat gippity,\nwith multiple lines.\n:::';

	it("extracts block directives", () => {
		const xmlExtract = DirectiveUtils.extractFromHtml(BLOCK_HTML, "quote");
		const markdownExtract = DirectiveUtils.extractFromMarkdown(
			BLOCK_MARKDOWN,
			"quote",
		);

		expect(clean(xmlExtract)).toEqual(clean(markdownExtract));
	});

	it("converts inline directives", () => {
		const xmlExtract = DirectiveUtils.extractFromHtml(INLINE_XML, "cite");
		const markdownExtract = DirectiveUtils.extractFromMarkdown(
			INLINE_MARKDOWN,
			"cite",
		);

		expect(DirectiveUtils.convertToMarkdown(xmlExtract, "cite")).toEqual(
			INLINE_MARKDOWN,
		);
		expect(DirectiveUtils.convertToHtml(markdownExtract, "cite")).toEqual(
			INLINE_XML,
		);
	});

	it("converts block directives", () => {
		const xmlExtract = DirectiveUtils.extractFromHtml(BLOCK_HTML, "quote");
		const markdownExtract = DirectiveUtils.extractFromMarkdown(
			BLOCK_MARKDOWN,
			"quote",
		);

		expect(DirectiveUtils.convertToMarkdown(xmlExtract, "quote")).toEqual(
			BLOCK_MARKDOWN,
		);
		expect(DirectiveUtils.convertToHtml(markdownExtract, "quote")).toEqual(
			BLOCK_HTML,
		);
	});
});
