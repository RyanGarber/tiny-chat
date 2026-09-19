import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { zConfig } from "../../data/types/message.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentMessage } from "../types/agent.ts";
import { AgentMessagesService } from "./AgentMessagesService.ts";

type NoId<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
type zAgentMessageNoPartIds = Omit<zAgentMessage, "data"> & {
	data: (NoId<zAgentMessage["data"][number][number], "id"> & {
		id?: string;
	})[][];
};
function noPartIds(message: zAgentMessageNoPartIds): zAgentMessage {
	return {
		...message,
		data: message.data.map((step) => step.map(({ id, ...rest }) => rest)),
	} as zAgentMessage;
}

describe("AgentMessagesService", () => {
	it("builds model parts from a stored attachment without reading it again", () => {
		const parts = AgentMessagesService.buildAttachmentParts({
			id: "attachment-1",
			type: "attachment",
			source: "/project/src",
			label: "src",
			content: {
				type: "directory",
				items: [
					{ path: "/project/src/index.ts" },
					{ path: "/project/src/components", directory: true },
				],
			},
		});

		expect(parts).toEqual([
			expect.objectContaining({
				type: "text",
				value: '<attachment source="/project/src" name="src">',
			}),
			expect.objectContaining({
				id: "attachment-1",
				type: "text",
				value: expect.stringContaining(
					'<file name="index.ts" path="/project/src/index.ts" />',
				),
			}),
			expect.objectContaining({ type: "text", value: "</attachment>" }),
		]);
	});

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
				data: [
					[{ id: CommonUtils.getRandomId(), type: "text", value: "Hello" }],
				],
				createdAt: CommonUtils.parsePlainDateTime("2026-01-01T00:00:00Z"),
			},
			{
				id: "2",
				author: "MODEL",
				config,
				data: [
					[{ id: CommonUtils.getRandomId(), type: "text", value: "Hi there" }],
				],
				createdAt: CommonUtils.parsePlainDateTime("2026-01-01T00:00:01Z"),
			},
			{
				id: "3",
				author: "USER",
				config,
				data: [
					[
						{
							id: CommonUtils.getRandomId(),
							type: "text",
							value: "Hello again",
						},
					],
				],
				createdAt: CommonUtils.parsePlainDateTime("2026-01-01T00:15:01Z"),
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

		expect(noPartIds(builtContext[0])).toEqual(
			noPartIds({
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
			} satisfies zAgentMessageNoPartIds),
		);

		expect(noPartIds(builtContext[1])).toEqual(
			noPartIds({
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
			} satisfies zAgentMessageNoPartIds),
		);

		expect(noPartIds(builtContext[2])).toEqual(
			noPartIds({
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
			} satisfies zAgentMessageNoPartIds),
		);
	});

	it("builds a file tree from a directory", () => {
		const tree = FileUtils.toTree({
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
		});

		expect(
			AgentMessagesService.buildTree({
				tree,
				depth: 1,
			}),
		).toEqual(
			`  <file name="README.md" path="${PathUtils.toMount({ mount: "uploads", id: "UPLOAD_ID", path: ["README.md"] })}" />
  <folder name="src">
    <folder name="gen" />
  </folder>`,
		);

		expect(
			AgentMessagesService.buildTree({
				tree,
				depth: 1,
				maxDepth: 4,
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
