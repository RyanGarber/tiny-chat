import { describe, expect, it } from "vitest";
import { zConfig, type zDataPart } from "../../data/types/message.ts";
import type { zAgentMessage } from "../types/agent.ts";
import { AgentTokensService } from "./AgentTokensService.ts";

const config = (tokens: number) =>
	zConfig.parse({
		provider: "test",
		model: "test",
		args: {},
		toolsets: [],
		skills: [],
		tokens,
	});

const message = (
	author: "USER" | "MODEL",
	parts: zDataPart[],
): zAgentMessage => ({
	id: null,
	author,
	data: [parts],
	config: null,
	createdAt: null,
});

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
		expect(compacted[0]).not.toBe(messages[0]);
		expect(compacted[0].data).not.toBe(messages[0].data);
		expect(compacted[0].data[0]).not.toBe(messages[0].data[0]);
		expect(compacted[0].data[0][0]).not.toBe(messages[0].data[0][0]);
		expect(compacted[0].config).not.toBe(messages[0].config);
		expect(compacted[0].createdAt).not.toBe(messages[0].createdAt);

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

	it("masks old tool output before touching recent messages", async () => {
		const messages = [
			message("MODEL", [
				{
					type: "toolResult",
					id: "tool-1",
					name: "web_search",
					value: [{ type: "text", value: "result\n".repeat(100) }],
				},
			]),
			message("USER", [{ type: "text", value: "u".repeat(300) }]),
			message("MODEL", [{ type: "text", value: "m".repeat(300) }]),
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(200),
		});
		const oldResult = compacted[0].data[0][0];

		expect(oldResult.type).toBe("toolResult");
		if (oldResult.type !== "toolResult")
			throw new Error("Expected tool result");
		expect(oldResult.value).toEqual([
			{
				type: "text",
				value: expect.stringContaining("[tool result compacted: 101 lines"),
			},
		]);
		expect(compacted[1]).toEqual(messages[1]);
		expect(compacted[2]).toEqual(messages[2]);
		expect(
			AgentTokensService.getTokens({ messages: compacted }),
		).toBeLessThanOrEqual(200);
	});

	it("collapses the oldest complete turn before recent conversation", async () => {
		const messages = [
			message("USER", [{ type: "text", value: "old user ".repeat(100) }]),
			message("MODEL", [{ type: "text", value: "old model ".repeat(100) }]),
			message("USER", [{ type: "text", value: "recent prompt" }]),
			message("MODEL", [{ type: "text", value: "current response" }]),
		];

		const compacted = await AgentTokensService.trimMessages({
			messages,
			config: config(30),
		});

		expect(compacted).toHaveLength(3);
		expect(compacted[0].author).toBe("USER");
		expect(compacted[0].data).toEqual([
			[{ type: "text", value: "[one earlier conversation turn omitted]" }],
		]);
		expect(compacted[1]).toEqual(messages[2]);
		expect(compacted[2]).toEqual(messages[3]);
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

		expect(AgentTokensService.getTokens({ data: [part] })).toBe(4);
	});
});
