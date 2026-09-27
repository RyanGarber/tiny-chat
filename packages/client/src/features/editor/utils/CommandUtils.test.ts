import type { CommandGroup } from "../types/command.ts";
import { CommandUtils } from "./CommandUtils.ts";

describe("CommandUtils", () => {
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
