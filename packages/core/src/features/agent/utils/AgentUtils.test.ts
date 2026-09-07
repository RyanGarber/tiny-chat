import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { zConfig } from "../../data/types/message.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentMessage } from "../types/agent.ts";
import { AgentUtils } from "./AgentUtils.ts";

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
});
