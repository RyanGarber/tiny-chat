import { expect } from "vitest";
import type { zSettings } from "../../features/data/types/user.ts";
import { SettingsUtils } from "./SettingsUtils.ts";

describe("SettingsUtils", () => {
	it("merges folder settings into user settings", () => {
		const user: zSettings = {
			instructions: ["Keep responses short."],
			memoryBudget: 2500,
			presets: {
				main: {
					provider: "openai",
					model: "gpt-5.6-luna",
					args: {},
					skills: ["find-skills"],
					toolsets: ["web"],
				},
			},
			hiddenModels: {
				language: [{ provider: "openai", model: "gpt-4" }],
			},
		};

		const folder1: zSettings = {
			instructions: ["Run all tests after writing code."],
			memoryBudget: 1000,
			presets: {
				main: {
					provider: "openai",
					model: "gpt-6-astra",
					args: {},
					skills: ["find-skills", "github"],
					toolsets: ["web", "shell"],
				},
			},
		};
		expect(SettingsUtils.merge({ to: user, from: folder1 })).toEqual({
			instructions: [
				"Keep responses short.",
				"Run all tests after writing code.",
			],
			memoryBudget: 1000,
			presets: {
				main: {
					provider: "openai",
					model: "gpt-6-astra",
					args: {},
					skills: ["find-skills", "github"],
					toolsets: ["web", "shell"],
				},
			},
			hiddenModels: {
				language: [{ provider: "openai", model: "gpt-4" }],
			},
		});

		const folder2: zSettings = {
			presets: {
				research: {
					provider: "google",
					model: "gemini-3.8-flash",
					args: {},
					skills: ["deep-research"],
					toolsets: ["web"],
				},
			},
			hiddenModels: {
				embedding: [{ provider: "voyage", model: "voyage-4" }],
			},
		};
		expect(SettingsUtils.merge({ to: user, from: folder2 })).toEqual({
			instructions: ["Keep responses short."],
			memoryBudget: 2500,
			presets: {
				main: {
					provider: "openai",
					model: "gpt-5.6-luna",
					args: {},
					skills: ["find-skills"],
					toolsets: ["web"],
				},
				research: {
					provider: "google",
					model: "gemini-3.8-flash",
					args: {},
					skills: ["deep-research"],
					toolsets: ["web"],
				},
			},
			hiddenModels: {
				language: [{ provider: "openai", model: "gpt-4" }],
				embedding: [{ provider: "voyage", model: "voyage-4" }],
			},
		});
	});

	it("dedupes whitelists and puts folder paths first", () => {
		const merged = SettingsUtils.of(
			{
				settings: {
					commandWhitelist: ["npm run *", "git push"],
					folders: [
						{ path: "/app", writable: false },
						{ path: "/shared", writable: true },
					],
				},
			},
			{
				settings: {
					commandWhitelist: ["git push", "make"],
					folders: [
						{ path: "/project", writable: true },
						{ path: "/shared", writable: false },
					],
				},
			},
		);
		expect(merged.commandWhitelist).toEqual(["npm run *", "git push", "make"]);
		expect(merged.folders).toEqual([
			{ path: "/project", writable: true },
			{ path: "/shared", writable: false },
			{ path: "/app", writable: false },
		]);
		expect(SettingsUtils.of({ settings: {} }).folders).toEqual([]);
	});
});
