import { describe, expect, it } from "vitest";
import { SnippetService } from "./SnippetService.ts";

const prose =
	"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

describe("SnippetService", () => {
	it("centres a prose snippet on the match", () => {
		const snippet = SnippetService.getSnippet({
			text: prose,
			query: "ad minim",
			maxChars: 60,
		});

		expect(snippet).toContain("ad minim");
	});

	it("never exceeds the character budget", () => {
		const text = `${"filler ".repeat(5_000)}needle${" filler".repeat(5_000)}`;

		for (const maxChars of [40, 140, 500]) {
			const snippet = SnippetService.getSnippet({
				text,
				query: "needle",
				maxChars,
			});
			expect(snippet.length).toBeLessThanOrEqual(maxChars + 2);
		}
	});

	it("bounds excerpts of a file whose every line matches", () => {
		const text = `${"const user = getUser();\n".repeat(50_000)}`;

		const excerpt = SnippetService.getExcerpt({
			text,
			query: "user",
			maxChars: 400,
		});

		expect(excerpt.length).toBeLessThanOrEqual(400);
	});

	it("returns matching lines with their line numbers", () => {
		const text = ["const a = 1;", "const target = 2;", "const b = 3;"].join(
			"\n",
		);

		expect(SnippetService.getLines({ text, query: "target" })).toEqual([
			{ number: 2, text: "const target = 2;" },
		]);
	});

	it("ranks a definition above a file that merely repeats the term", () => {
		const definition = "export const getUserSession = () => session;";
		const noise = "user\n".repeat(2_000);

		const scores = {
			definition: SnippetService.getScore({
				text: definition,
				query: "getUserSession",
			}).score,
			noise: SnippetService.getScore({ text: noise, query: "getUserSession" })
				.score,
		};

		expect(scores.definition).toBeGreaterThan(scores.noise);
	});

	it("scores a file matching every term above one matching a single term", () => {
		const both = SnippetService.getScore({
			text: "function parseConfig(config) { return config; }",
			query: "parse config",
		});
		const one = SnippetService.getScore({
			text: "const config = {};\n".repeat(100),
			query: "parse config",
		});

		expect(both.score).toBeGreaterThan(one.score);
		expect(both.terms).toBe(2);
	});

	it("matches identifiers written in a different case style", () => {
		const score = SnippetService.getScore({
			text: "const get_user_by_id = () => {};",
			query: "getUserById",
		});

		expect(score.score).toBeGreaterThan(0);
	});
});
