import { describe, expect, it } from "vitest";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { zConfig } from "../../data/types/message.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentMessage } from "../types/agent.ts";
import { AgentMessagesService } from "./AgentMessagesService.ts";

describe("AgentMessagesService", () => {
	it("builds a message tree from context", () => {
		const config = zConfig.parse({
			provider: "openai",
			model: "gpt-5",
			args: {},
			toolsets: [],
			skills: [],
		});

		const context: zAgentMessage[] = [
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
			AgentMessagesService.buildMessageBlock({
				message,
				previous: array[i - 1],
				parts: message.data.flat(),
				timezone: "America/New_York",
			}),
		);

		expect(builtContext[0]).toEqual({
			...context[0],
			data: [
				[
					{
						type: "text",
						value: `<message role="user" sent="${CommonUtils.formatDate({ date: context[0].createdAt ?? undefined, timezone: "America/New_York" })}">`,
					},
					...context[0].data.flat(),
					{ type: "text", value: "</message>" },
				],
			],
		} satisfies zAgentMessage);

		expect(builtContext[1]).toEqual({
			...context[1],
			data: [
				[
					{
						type: "text",
						value: `<message role="assistant" model="gpt-5" sent="${CommonUtils.formatDate({ date: context[1].createdAt ?? undefined, timezone: "America/New_York" })}">`,
					},
					...context[1].data.flat(),
					{ type: "text", value: "</message>" },
				],
			],
		} satisfies zAgentMessage);

		expect(builtContext[2]).toEqual({
			...context[2],
			data: [
				[
					{
						type: "text",
						value: `<message role="user" sent="${CommonUtils.formatDate({ date: context[2].createdAt ?? undefined, timezone: "America/New_York" })}" gap="15 minutes">`,
					},
					...context[2].data.flat(),
					{ type: "text", value: "</message>" },
				],
			],
		} satisfies zAgentMessage);
	});

	it("builds a file tree from a directory", () => {
		expect(
			AgentMessagesService.buildTree({
				tree: FileUtils.toTree({
					nodes: [
						{
							path: ["README.md"],
							uri: "/mnt/uploads/UPLOAD_ID/README.md",
						},
						{
							path: ["src", "gen", "lib", "main.so"],
							uri: "/mnt/uploads/UPLOAD_ID/src/gen/lib/main.so",
						},
					],
				}),
				depth: 1,
			}),
		).toEqual(
			`  <file name="README.md" path="${PathUtils.toMount({ mount: "uploads", id: "UPLOAD_ID", path: ["README.md"] })}" />
  <folder name="src">
    <folder name="gen">
      <folder name="lib">
        <file name="main.so" path="${PathUtils.toMount({ mount: "uploads", id: "UPLOAD_ID", path: ["src", "gen", "lib", "main.so"] })}" />
      </folder>
    </folder>
  </folder>`,
		);
	});
});
