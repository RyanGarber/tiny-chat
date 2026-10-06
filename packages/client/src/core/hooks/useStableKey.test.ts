import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	getPartsKey,
	getToolsetsKey,
	getValueKey,
} from "#client/core/hooks/useStableKey.ts";
import type { Toolset } from "#core/features/tool/types/tool.ts";

describe("useStableKey", () => {
	it("changes when a middle part changes without changing its length", () => {
		const before = getPartsKey([
			{ type: "text", id: "first", value: "same" },
			{ type: "text", id: "middle", value: "alpha" },
			{ type: "text", id: "last", value: "same" },
		]);
		const after = getPartsKey([
			{ type: "text", id: "first", value: "same" },
			{ type: "text", id: "middle", value: "bravo" },
			{ type: "text", id: "last", value: "same" },
		]);

		expect(after).not.toBe(before);
	});

	it("is stable across object property insertion order", () => {
		expect(getValueKey({ a: 1, b: { c: 2 } })).toBe(
			getValueKey({ b: { c: 2 }, a: 1 }),
		);
	});

	it("changes when a tool schema changes without changing the tool count", () => {
		const build = (input: z.ZodType): Toolset<void>[] => [
			{
				name: "test",
				capabilities: undefined,
				status: { valid: true },
				tools: [
					{
						name: "search",
						description: "Search for something",
						input,
						output: z.unknown(),
						capabilities: undefined,
						execute: async () => [],
					},
				],
			},
		];

		expect(getToolsetsKey(build(z.object({ query: z.string() })))).not.toBe(
			getToolsetsKey(build(z.object({ path: z.string() }))),
		);
	});
});
