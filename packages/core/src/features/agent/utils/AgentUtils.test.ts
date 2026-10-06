import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { zAgentMessage } from "#core/features/agent/types/agent.ts";
import { AgentUtils } from "#core/features/agent/utils/AgentUtils.ts";
import { zConfig } from "#core/features/data/types/message.ts";
import type { zDataPart } from "#core/features/data/types/part.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";

const UPLOAD = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SKILL = "cccccccccccccccccccccccc";

const config = zConfig.parse({
	provider: "openai",
	model: "gpt-5",
	args: {},
	toolsets: [],
	skills: [],
});

const message = (
	attachments: string[] = [],
	skills: string[] = [],
): zAgentMessage => ({
	id: null,
	author: "USER",
	config: { ...config, skills },
	data: [
		attachments.map((source) => ({
			id: CommonUtils.getRandomId(),
			type: "attachment" as const,
			source,
			label: PathUtils.name(source),
			content: { type: "directory" as const, items: [] },
		})),
	],
	createdAt: null,
});

describe("AgentUtils", () => {
	it("takes an upload from an attachment part", () => {
		expect(
			AgentUtils.getMounts({
				messages: [message([`/mnt/uploads/${UPLOAD}`])],
			}),
		).toEqual({ uploads: [UPLOAD], skills: [] });
	});

	it("takes an upload from a path pointing inside it", () => {
		expect(
			AgentUtils.getMounts({
				messages: [message([`/mnt/uploads/${UPLOAD}/src/index.ts`])],
			}),
		).toEqual({ uploads: [UPLOAD], skills: [] });
	});

	it("takes a skill from the message's config, apart from its uploads", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message(
						[`/mnt/uploads/${UPLOAD}`],
						[
							PathUtils.toMount({
								mount: "skills",
								id: SKILL,
								path: ["SKILL.md"],
							}),
						],
					),
				],
			}),
		).toEqual({ uploads: [UPLOAD], skills: [SKILL] });
	});

	it("ignores skills and attachments outside the mount", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message(
						["/Users/me/notes.md"],
						["/Users/me/.agents/skills/pdf/SKILL.md"],
					),
					message(["web:https://example.com"]),
				],
			}),
		).toEqual({ uploads: [], skills: [] });
	});

	it("reports each upload once, across messages", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message([`/mnt/uploads/${UPLOAD}`]),
					message([`/mnt/uploads/${UPLOAD}/README.md`]),
					message([`/mnt/uploads/${OTHER}`]),
				],
			}),
		).toEqual({ uploads: [UPLOAD, OTHER], skills: [] });
	});

	describe("getToolResultsSorted", () => {
		const call = (id: string): zDataPart => ({
			type: "toolCall",
			id,
			name: "tool",
			input: {},
		});
		const result = (id: string): zDataPart => ({
			type: "toolResult",
			id,
			name: "tool",
			output: [],
		});

		it("puts results in call order, straight after the calls", () => {
			const report: zDataPart = {
				type: "interjection",
				id: "report",
				value: [],
				task: { id: "b", name: "tool" },
			};
			// `a` was approved after `b` had already reported in.
			expect(
				AgentUtils.getToolResultsSorted({
					data: [call("a"), call("b"), result("b"), report, result("a")],
				}).map((part) => `${part.type} ${part.id}`),
			).toEqual([
				"toolCall a",
				"toolCall b",
				"toolResult a",
				"toolResult b",
				"interjection report",
			]);
		});

		it("moves an approved result ahead of a report that came first", () => {
			// The step stopped for approval and waited on a background call, whose
			// report landed before the approved result was added.
			const report: zDataPart = {
				type: "interjection",
				id: "report",
				value: [],
				task: { id: "x", name: "tool" },
			};
			expect(
				AgentUtils.getToolResultsSorted({
					data: [call("a"), report, result("a")],
				}).map((part) => `${part.type} ${part.id}`),
			).toEqual(["toolCall a", "toolResult a", "interjection report"]);
		});
	});
});
