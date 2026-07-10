import { describe, expect, it } from "vitest";
import type { zContextItem } from "../../types/chat.ts";
import { toChatUri } from "../../utils/files.ts";
import { buildFileTree, buildMessageTree } from "./context.ts";
import { formatLocalDate } from "./instructions.ts";

describe("services - context", () => {
	it("builds a message tree from context", () => {
		const config = {
			provider: "openai",
			model: "gpt-5",
			toolGroups: [],
			skills: [],
		};

		const context: zContextItem[] = [
			{
				id: "1",
				author: "USER",
				config,
				data: [[{ type: "text", value: "Hello" }]],
				createdAt: new Date("2026-01-01T00:00:00Z"),
			},
			{
				id: "2",
				author: "MODEL",
				config,
				data: [[{ type: "text", value: "Hi there" }]],
				createdAt: new Date("2026-01-01T00:00:01Z"),
			},
			{
				id: "3",
				author: "USER",
				config,
				data: [[{ type: "text", value: "Hello again" }]],
				createdAt: new Date("2026-01-01T00:15:01Z"),
			},
		];

		const builtContext = context.map((message, i, array) =>
			buildMessageTree(message, array[i - 1], message.data, "America/New_York"),
		);

		expect(builtContext[0]).toEqual({
			...context[0],
			data: [
				[
					{
						type: "text",
						value: `<message role="user" sent="${formatLocalDate(context[0].createdAt ?? undefined, "America/New_York")}">`,
					},
				],
				...context[0].data,
				[{ type: "text", value: "</message>" }],
			],
		} satisfies zContextItem);

		expect(builtContext[1]).toEqual({
			...context[1],
			data: [
				[
					{
						type: "text",
						value: `<message role="assistant" model="gpt-5" sent="${formatLocalDate(context[1].createdAt ?? undefined, "America/New_York")}">`,
					},
				],
				...context[1].data,
				[{ type: "text", value: "</message>" }],
			],
		} satisfies zContextItem);

		expect(builtContext[2]).toEqual({
			...context[2],
			data: [
				[
					{
						type: "text",
						value: `<message role="user" sent="${formatLocalDate(context[2].createdAt ?? undefined, "America/New_York")}" gap="15 minutes">`,
					},
				],
				...context[2].data,
				[{ type: "text", value: "</message>" }],
			],
		} satisfies zContextItem);
	});

	it("builds a file tree from an upload", () => {
		expect(
			buildFileTree({ id: "uid", name: "uname" }, [
				{ path: [""] },
				{ path: ["src"] },
				{ path: ["src", ""] },
				{ path: ["", "src", ""] },
				{ path: ["src", "index.ts"] },
				{ path: ["src", "index.ts", ""] },
				{ path: ["src", "", "index.ts", ""] },
				{ path: ["", "src", "", "gen", "lib", "main.so"] },
			]),
		).toEqual(
			`<attachment name="uname" path="${toChatUri("uid")}">
  <folder name="src">
    <file name="index.ts" path="${toChatUri("uid", ["src", "index.ts"])}" />
    <folder name="gen">
      <folder name="lib">
        <file name="main.so" path="${toChatUri("uid", ["src", "gen", "lib", "main.so"])}" />
      </folder>
    </folder>
  </folder>
</attachment>`,
		);
	});
});
