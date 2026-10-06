import type { CommandGroup } from "#client/features/editor/types/command.ts";
import { CommandUtils } from "#client/features/editor/utils/CommandUtils.ts";

describe("CommandUtils", () => {
	it("matches command names without typing punctuation", () => {
		const groups: CommandGroup[] = [
			{ items: [{ name: "set-preset", value: "set-preset" }] },
		];

		expect(
			CommandUtils.filter({ groups, query: "setpres" })[0].items.map(
				(item) => item.value,
			),
		).toEqual(["set-preset"]);
	});

	it("puts an exact command match before commands containing it", () => {
		const groups: CommandGroup[] = [
			{
				items: [
					{ name: "set-preset", value: "set-preset" },
					{ name: "unset-preset", value: "unset-preset" },
					{ name: "preset", value: "preset" },
				],
			},
		];

		expect(
			CommandUtils.filter({ groups, query: "preset" })[0].items.map(
				(item) => item.value,
			),
		).toEqual(["preset", "set-preset", "unset-preset"]);
	});
});
