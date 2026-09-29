import type { CompletionItem } from "../types/completion.ts";
import { CompletionUtils } from "./CompletionUtils.ts";

describe("CompletionUtils", () => {
	it("orders exact, prefix, and substring matches intuitively", () => {
		const items: CompletionItem[] = [
			{ value: "set-preset" },
			{ value: "unset-preset" },
			{ value: "preset" },
			{ value: "presets" },
		];

		expect(
			CompletionUtils.filter({ items, query: "preset" }).map(
				(item) => item.value,
			),
		).toEqual(["preset", "presets", "set-preset", "unset-preset"]);
	});

	it("ignores punctuation when matching completion names", () => {
		const items: CompletionItem[] = [{ value: "set-preset" }];

		expect(
			CompletionUtils.filter({ items, query: "setpres" }).map(
				(item) => item.value,
			),
		).toEqual(["set-preset"]);
	});

	it("preserves declaration order for equally weighted matches", () => {
		const items: CompletionItem[] = [
			{ value: "settings" },
			{ value: "set-preset" },
		];

		expect(
			CompletionUtils.filter({ items, query: "set" }).map((item) => item.value),
		).toEqual(["settings", "set-preset"]);
	});
});
