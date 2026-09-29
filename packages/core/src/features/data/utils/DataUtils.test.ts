import { describe, expect, it } from "vitest";
import type { zData } from "../types/part.ts";
import { DataUtils } from "./DataUtils.ts";

describe("DataUtils", () => {
	describe("getRenderedPartsGrouped", () => {
		it("breaks a run of tool calls at every thought", () => {
			const call = (id: string) =>
				({ type: "toolCall", id, name: "read_file", input: {} }) as const;
			const thought = (id: string) =>
				({ type: "thought", id, value: id }) as const;
			const data: zData = [
				[thought("t1"), thought("t2"), call("c1"), call("c2")],
				[thought("t3"), call("c3"), { type: "text", id: "x", value: "done" }],
			];

			const parts = DataUtils.getRenderedPartsGrouped(
				data,
				false,
				"thought",
				"toolCall",
			);
			expect(
				parts.map((part) =>
					part.type === "group"
						? `${part.of}:${part.value.map((item) => item.id).join(",")}`
						: part.type,
				),
			).toEqual([
				"thought:t1,t2",
				"toolCall:c1,c2",
				"thought:t3",
				"toolCall:c3",
				"text",
			]);
		});
	});
});
