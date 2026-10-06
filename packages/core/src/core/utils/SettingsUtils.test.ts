import { expect } from "vitest";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";
import type { zSettings } from "#core/features/data/types/user.ts";

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

	it("keeps every entry and puts folder entries last", () => {
		const merged = SettingsUtils.of(
			{
				settings: {
					commands: [
						{ command: "npm run *", whitelist: false },
						{ command: "git push", whitelist: true },
					],
					folders: [
						{ path: "/app", whitelist: false },
						{ path: "/shared", whitelist: true },
					],
				},
			},
			{
				settings: {
					commands: [
						{ command: "git push", whitelist: true },
						{ command: "make", whitelist: false },
					],
					folders: [
						{ path: "/project", whitelist: true },
						{ path: "/shared", whitelist: false },
					],
				},
			},
		);
		expect(merged.commands).toEqual([
			{ command: "npm run *", whitelist: false },
			{ command: "git push", whitelist: true },
			{ command: "git push", whitelist: true },
			{ command: "make", whitelist: false },
		]);
		expect(merged.folders).toEqual([
			{ path: "/app", whitelist: false },
			{ path: "/shared", whitelist: true },
			{ path: "/project", whitelist: true },
			{ path: "/shared", whitelist: false },
		]);
		expect(SettingsUtils.of({ settings: {} }).folders).toEqual([]);
	});

	it("picks the project's first folder as primary, else the user's", () => {
		const user = { settings: { folders: [{ path: "/app", whitelist: true }] } };
		const project = {
			settings: {
				folders: [
					{ path: "/project", whitelist: true },
					{ path: "/other", whitelist: true },
				],
			},
		};
		expect(SettingsUtils.primaryFolder(user, project)).toBe("/project");
		expect(SettingsUtils.primaryFolder(user, { settings: {} })).toBe("/app");
		expect(SettingsUtils.primaryFolder(user)).toBe("/app");
		expect(SettingsUtils.primaryFolder({ settings: {} })).toBeNull();
	});
});
