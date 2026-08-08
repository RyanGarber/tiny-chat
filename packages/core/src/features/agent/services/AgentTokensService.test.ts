import { describe, expect, it } from "vitest";
import { zConfig, type zDataPart } from "../../data/types/message.ts";
import type { zAgentMessage } from "../types/agent.ts";
import { AgentTokensService } from "./AgentTokensService.ts";

const config = (tokens: number) =>
	zConfig.parse({
		provider: "test",
		model: "test",
		args: { "tokens-in": tokens },
		toolsets: [],
		skills: [],
	});

const message = (
	author: "USER" | "MODEL",
	parts: zDataPart[] | zDataPart[][],
): zAgentMessage => ({
	id: null,
	author,
	data: Array.isArray(parts[0])
		? (parts as zDataPart[][])
		: [parts as zDataPart[]],
	config: null,
	createdAt: null,
});

const getText = (message: zAgentMessage) =>
	message.data
		.flat()
		.map((part) =>
			"value" in part && typeof part.value === "string" ? part.value : "",
		)
		.join("\n");

describe("AgentTokensService", () => {
	it("returns a deep value copy even when compaction is unnecessary", async () => {
		const messages = [
			{
				...message("MODEL", [
					{
						type: "toolResult" as const,
						id: "tool-1",
						name: "read_file",
						value: [{ type: "json" as const, value: { nested: ["value"] } }],
					},
				]),
				config: config(1_000),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(1_000),
		});

		expect(compacted).toEqual(messages);
		expect(compacted).not.toBe(messages);
		expect(compacted[0].data[0][0]).not.toBe(messages[0].data[0][0]);

		const result = compacted[0].data[0][0];
		if (result.type !== "toolResult" || result.value[0].type !== "json") {
			throw new Error("Expected a JSON tool result");
		}
		result.value[0].value.nested[0] = "changed";

		const original = messages[0].data[0][0];
		if (original.type !== "toolResult" || original.value[0].type !== "json") {
			throw new Error("Expected a JSON tool result");
		}
		expect(original.value[0].value.nested[0]).toBe("value");
	});

	it("keeps the task and the current request while giving up tool output", async () => {
		const messages = [
			message("USER", [{ type: "text", value: "Fix the failing login test." }]),
			message("MODEL", [
				[
					{
						type: "toolResult",
						id: "tool-1",
						name: "grep_files",
						value: [{ type: "text", value: "noise\n".repeat(2_000) }],
					},
				],
				[{ type: "text", value: "Looking into it." }],
			]),
			message("USER", [{ type: "text", value: "Any progress?" }]),
			message("MODEL", [{ type: "text", value: "Almost there." }]),
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(200),
		});

		expect(getText(compacted[0])).toBe("Fix the failing login test.");
		expect(getText(compacted[2])).toBe("Any progress?");
		expect(getText(compacted[3])).toBe("Almost there.");

		const result = compacted[1].data[0][0];
		if (result.type !== "toolResult") throw new Error("Expected a tool result");
		expect(result.value).toEqual([
			{
				type: "text",
				value: expect.stringContaining("grep_files result elided"),
			},
		]);
		expect(
			AgentTokensService.getTokens({ messages: compacted }),
		).toBeLessThanOrEqual(200);
	});

	it("gives up the largest tool result before several small ones", async () => {
		const messages = [
			message("USER", [{ type: "text", value: "task" }]),
			message("MODEL", [
				[
					{
						type: "toolResult",
						id: "tool-1",
						name: "read_file",
						value: [{ type: "text", value: "huge\n".repeat(1_000) }],
					},
					{
						type: "toolResult",
						id: "tool-2",
						name: "read_file",
						value: [{ type: "text", value: "small result" }],
					},
				],
				[{ type: "text", value: "done" }],
				[{ type: "text", value: "done" }],
				[{ type: "text", value: "done" }],
			]),
			message("USER", [{ type: "text", value: "now what" }]),
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(120),
		});

		const [first, second] = compacted[1].data[0];
		if (first.type !== "toolResult" || second.type !== "toolResult") {
			throw new Error("Expected tool results");
		}
		expect(first.value[0]).toEqual({
			type: "text",
			value: expect.stringContaining("elided"),
		});
		expect(second.value).toEqual([{ type: "text", value: "small result" }]);
	});

	it("drops reasoning the model has already acted on", async () => {
		const messages = [
			message("USER", [{ type: "text", value: "task" }]),
			message("MODEL", [
				[
					{
						type: "thought",
						value: "old thinking ".repeat(200),
						signature: { reasoning: "old" },
					},
				],
				[{ type: "text", value: "step two" }],
				[{ type: "text", value: "step three" }],
				[
					{
						type: "thought",
						value: "current thinking",
						signature: { reasoning: "now" },
					},
				],
			]),
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(60),
		});

		const parts = compacted[1].data.flat();
		expect(
			parts.some(
				(part) => part.type === "thought" && part.value.startsWith("old"),
			),
		).toBe(false);
		expect(parts.at(-1)).toEqual({
			type: "thought",
			value: "current thinking",
			signature: { reasoning: "now" },
		});
	});

	it("summarizes a middle turn instead of deleting it", async () => {
		const messages = [
			message("USER", [{ type: "text", value: "Build the importer." }]),
			message("MODEL", [
				[
					{
						type: "toolCall",
						id: "tool-1",
						name: "edit_file",
						args: { path: "src/parser.ts" },
					},
					// Many small parts: excerpting each one saves nothing, so only a
					// digest of the whole turn can bring the message down.
					...Array.from(
						{ length: 30 },
						(_, index): zDataPart => ({
							type: "text",
							value: `Parser step ${index}. `.repeat(10),
						}),
					),
				],
			]),
			message("USER", [{ type: "text", value: "Now the writer." }]),
			message("MODEL", [{ type: "text", value: "On it." }]),
			message("USER", [{ type: "text", value: "And the tests." }]),
			message("MODEL", [{ type: "text", value: "Sure." }]),
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(160),
		});

		const digest = getText(compacted[1]);
		expect(digest).toContain("earlier assistant turn, summarized");
		expect(digest).toContain("edit_file(src/parser.ts)");
		expect(getText(compacted[0])).toBe("Build the importer.");
		expect(getText(compacted[4])).toBe("And the tests.");
	});

	it("preserves every live part and signature at an extremely small budget", async () => {
		const messages = [
			message("MODEL", [
				{
					type: "thought",
					value: "reasoning".repeat(100),
					signature: { reasoning: "encrypted-thought" },
				},
				{
					type: "toolCall",
					id: "tool-1",
					name: "read_file",
					args: { path: "x".repeat(1_000) },
					signature: { reasoning: "encrypted-tool-call" },
				},
				{
					type: "toolResult",
					id: "tool-1",
					name: "read_file",
					value: [
						{
							type: "text",
							value: "contents".repeat(100),
							signature: { reasoning: "encrypted-result" },
						},
					],
				},
				{
					type: "file",
					name: "image.png",
					mime: "image/png",
					data: "a".repeat(1_000),
					signature: { reasoning: "encrypted-file" },
				},
			]),
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(0),
		});
		const originalParts = messages[0].data.flat();
		const compactedParts = compacted[0].data.flat();

		expect(compactedParts).toHaveLength(originalParts.length);
		const getSignature = (part: zDataPart) =>
			"signature" in part ? part.signature : undefined;
		expect(compactedParts.map(getSignature)).toEqual(
			originalParts.map(getSignature),
		);
		const result = compactedParts[2];
		expect(result.type).toBe("toolResult");
		if (result.type !== "toolResult") throw new Error("Expected tool result");
		expect(result.value).toHaveLength(1);
		expect(result.value[0].signature).toEqual({
			reasoning: "encrypted-result",
		});
		expect(AgentTokensService.getTokens({ messages: compacted })).toBe(0);
		expect(messages[0].data.flat()).toEqual(originalParts);
	});

	it("counts appended tool output in token estimates", () => {
		const part: zDataPart = {
			type: "toolResult",
			id: "tool-1",
			name: "read_file",
			value: [{ type: "text", value: "1234567" }],
			append: [{ type: "text", value: "1234567" }],
		};

		expect(
			AgentTokensService.getTokens({
				messages: [
					{
						id: null,
						author: "MODEL",
						config: config(1_000),
						data: [[part]],
						createdAt: new Date(),
					},
				],
			}),
		).toBe(4);
	});
});
