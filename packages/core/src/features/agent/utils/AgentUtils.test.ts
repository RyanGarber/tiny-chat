import { describe, expect, it } from "vitest";
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

const message = (value: string, skills: string[] = []): zAgentMessage => ({
	id: null,
	author: "USER",
	config: { ...config, skills },
	data: [[{ type: "text", value }]],
	createdAt: null,
});

describe("AgentUtils.getMounts", () => {
	it("takes an upload from an attachment directive", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message(
						`look at :attachment[]{source="/mnt/uploads/${UPLOAD}" is-directory="true" name="repo@main"}`,
					),
				],
			}),
		).toEqual({ uploads: [UPLOAD], skills: [] });
	});

	it("takes an upload from a path pointing inside it", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message(
						`:attachment[]{source="/mnt/uploads/${UPLOAD}/src/index.ts" is-directory="false"}`,
					),
				],
			}),
		).toEqual({ uploads: [UPLOAD], skills: [] });
	});

	it("takes a skill from the message's config, apart from its uploads", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message(`:attachment[]{source="/mnt/uploads/${UPLOAD}"}`, [
						PathUtils.toMount({
							mount: "skills",
							id: SKILL,
							path: ["SKILL.md"],
						}),
					]),
				],
			}),
		).toEqual({ uploads: [UPLOAD], skills: [SKILL] });
	});

	it("ignores skills and attachments outside the mount", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message(
						`:attachment[]{source="/Users/me/notes.md" is-directory="false"}`,
						["/Users/me/.agents/skills/pdf/SKILL.md"],
					),
					message(`:attachment[]{source="web:https://example.com"}`),
				],
			}),
		).toEqual({ uploads: [], skills: [] });
	});

	it("reports each upload once, across messages", () => {
		expect(
			AgentUtils.getMounts({
				messages: [
					message(`:attachment[]{source="/mnt/uploads/${UPLOAD}"}`),
					message(`:attachment[]{source="/mnt/uploads/${UPLOAD}/README.md"}`),
					message(`:attachment[]{source="/mnt/uploads/${OTHER}"}`),
				],
			}),
		).toEqual({ uploads: [UPLOAD, OTHER], skills: [] });
	});
});
