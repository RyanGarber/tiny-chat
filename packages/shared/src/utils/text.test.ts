import { describe, expect, it } from "vitest";
import { directiveToXml, xmlToDirective } from "./text.ts";

describe("utils - text", () => {
	it("converts inline directives <-> xml", () => {
		const xml =
			'In a paragraph, <reference type="action" id="123">inline references exist</reference>.';
		const directive =
			"In a paragraph, :reference[inline references exist]{type=action id=123}.";

		expect(xmlToDirective(xml, ["reference"])).toEqual(directive);
		expect(directiveToXml(directive, ["reference"])).toEqual(xml);
		expect(xmlToDirective(xml, [])).toEqual(xml);
		expect(directiveToXml(directive, [])).toEqual(directive);
	});

	it("converts block directives <-> xml", () => {
		const xml = `<reference type="action" id="123">
Block references also exist.
They require multiple lines.
</reference>`;
		const directive = `:::reference{type=action id=123}
Block references also exist.
They require multiple lines.
:::`;

		expect(xmlToDirective(xml, ["reference"])).toEqual(directive);
		expect(directiveToXml(directive, ["reference"])).toEqual(xml);
		expect(xmlToDirective(xml, [])).toEqual(xml);
		expect(directiveToXml(directive, [])).toEqual(directive);
	});

	it("converts a mix of inline and block directives in the same document", () => {
		const xml = `Inline <reference type="action" id="123">reference</reference>.

<quote model="gpt-5.5">
Some quote from gippity.
With multiple lines.
</quote>`;
		const directive = `Inline :reference[reference]{type=action id=123}.

:::quote{model=gpt-5.5}
Some quote from gippity.
With multiple lines.
:::`;

		expect(xmlToDirective(xml, ["quote", "reference"])).toEqual(directive);
		expect(directiveToXml(directive, ["quote", "reference"])).toEqual(xml);
	});
});
