import { describe, expect, it } from "vitest";
import { EmbeddingUtils } from "./EmbeddingUtils.ts";

describe("EmbeddingUtils", () => {
	it("flattens a batch into typed input rows", () => {
		expect(
			EmbeddingUtils.toInput({
				messages: [{ id: "m1", text: "hello", total: "3" }],
				actions: [{ id: "a1", text: "remind" }],
				memories: [{ id: "mem1", text: "likes tea" }],
				files: [{ id: "f1", text: "readme" }],
			}),
		).toEqual([
			{ type: "message", id: "m1", text: "hello" },
			{ type: "action", id: "a1", text: "remind" },
			{ type: "memory", id: "mem1", text: "likes tea" },
			{ type: "file", id: "f1", text: "readme" },
		]);
	});

	it("reports batch and backlog totals for the status UI", () => {
		expect(
			EmbeddingUtils.getStatus({
				messages: [{ id: "m1", text: "a", total: "10" }],
				actions: [{ id: "a1", text: "b", total: "2" }],
				memories: [],
				files: [{ id: "f1", text: "c", total: "5" }],
			}),
		).toEqual({
			batch: {
				messages: [{ id: "m1", text: "a", total: "10" }],
				actions: [{ id: "a1", text: "b", total: "2" }],
				memories: [],
				files: [{ id: "f1", text: "c", total: "5" }],
			},
			batchCount: 3,
			totalCount: 17,
		});
	});

	it("treats ModelProviderService providers as server-capable", () => {
		expect(EmbeddingUtils.isServerProvider("openai")).toBe(true);
		expect(EmbeddingUtils.isServerProvider("voyage")).toBe(true);
		expect(EmbeddingUtils.isServerProvider("test")).toBe(true);
		expect(EmbeddingUtils.isServerProvider("native")).toBe(false);
		expect(EmbeddingUtils.isServerProvider("apple")).toBe(false);
	});
});
