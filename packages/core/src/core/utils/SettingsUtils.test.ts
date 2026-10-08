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

	it("orders primary candidates project first, then user, deduped", () => {
		const user = {
			settings: {
				folders: [
					{ path: "/app", whitelist: true },
					{ path: "/other", whitelist: false },
				],
			},
		};
		const project = {
			settings: {
				folders: [
					{ path: "/project", whitelist: true },
					{ path: "/other", whitelist: true },
				],
			},
		};
		expect(SettingsUtils.primaryCandidates(user, project)).toEqual([
			"/project",
			"/other",
			"/app",
		]);
		expect(SettingsUtils.primaryCandidates(user, { settings: {} })).toEqual([
			"/app",
			"/other",
		]);
		expect(SettingsUtils.primaryCandidates({ settings: {} })).toEqual([]);
	});

	it("tells whether a folder holds a path", () => {
		expect(SettingsUtils.contains({ folder: "/a", path: "/a" })).toBe(true);
		expect(SettingsUtils.contains({ folder: "/a/", path: "/a/b" })).toBe(true);
		expect(SettingsUtils.contains({ folder: "/a", path: "/ab" })).toBe(false);
		expect(SettingsUtils.contains({ folder: "/", path: "/a" })).toBe(true);
		expect(
			SettingsUtils.contains({ folder: "C:\\work", path: "C:\\work\\x" }),
		).toBe(true);
		expect(SettingsUtils.contains({ folder: "C:\\", path: "C:\\x" })).toBe(
			true,
		);
	});

	it("prefers the folder most closely holding the launch directory", () => {
		const paths = ["/elsewhere", "/repo", "/repo/sub"];
		expect(
			SettingsUtils.preferContaining({ paths, cwd: "/repo/sub/x" }),
		).toEqual(["/repo/sub", "/elsewhere", "/repo"]);
		expect(SettingsUtils.preferContaining({ paths, cwd: "/repo" })).toEqual([
			"/repo",
			"/elsewhere",
			"/repo/sub",
		]);
		expect(SettingsUtils.preferContaining({ paths, cwd: "/tmp" })).toEqual(
			paths,
		);
		expect(
			SettingsUtils.preferContaining({
				paths: ["C:\\repo"],
				cwd: "/c/repo/src",
				toShellPath: () => "/c/repo",
			}),
		).toEqual(["C:\\repo"]);
	});
});
