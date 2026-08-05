import { describe, expect, it } from "vitest";
import { SnippetService } from "./SnippetService.ts";

describe("utils - snippets", () => {
	const longText =
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

	it("should return a valid snippet", () => {
		const snippet = SnippetService.getSnippet({
			text: longText,
			query: "ad minim",
			baseWindow: 15,
		});

		console.log(snippet);

		expect(snippet).toContain("ad minim");
	});
});
