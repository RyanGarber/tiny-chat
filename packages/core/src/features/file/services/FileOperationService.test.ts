import { describe, expect, it } from "vitest";
import { FileOperationService } from "./FileOperationService.ts";
import { createShell } from "./FileSearchService.test.ts";

describe("FileOperationService", () => {
	it("searches file paths and text recursively while excluding dependencies", async () => {
		const shell = createShell({
			"/project/src/user-service.ts": "export const getUser = () => user;",
			"/project/src/other.ts": "nothing relevant",
			"/project/node_modules/user.ts": "user user user",
		});

		const report = await FileOperationService.searchFiles({
			shell,
			path: "/project",
			query: "user",
		});

		expect(report.results).toEqual([
			expect.objectContaining({ path: "/project/src/user-service.ts" }),
		]);
	});

	it("greps text with a regular expression", async () => {
		const shell = createShell({
			"/project/a.ts": "const answer = 42;",
			"/project/b.ts": "const answer = 'unknown';",
		});

		const report = await FileOperationService.grepFiles({
			shell,
			path: "/project",
			query: "answer\\s*=\\s*42",
		});

		expect(report.results.map((result) => result.path)).toEqual([
			"/project/a.ts",
		]);
	});

	it("edits through primitive reads and writes", async () => {
		const shell = createShell({ "/project/a.ts": "const value = 1;\n" });

		await expect(
			FileOperationService.editFile({
				shell,
				path: "/project/a.ts",
				old_string: "value = 1",
				new_string: "value = 2",
			}),
		).resolves.toEqual({
			path: "/project/a.ts",
			success: true,
			replacements: 1,
			preview: "1: const value = 2;\n2:",
		});
		await expect(shell.readFile({ path: "/project/a.ts" })).resolves.toEqual({
			path: "/project/a.ts",
			data: new TextEncoder().encode("const value = 2;\n"),
		});
	});

	describe("readText", () => {
		const file = Array.from(
			{ length: 3_000 },
			(_, index) => `line ${index + 1}`,
		).join("\n");

		it("windows a long file and says how to continue", async () => {
			const result = await FileOperationService.readText({
				shell: createShell({ "/project/long.ts": file }),
				path: "/project/long.ts",
			});

			expect(result.lines).toBe(1_000);
			expect(result.total).toBe(3_000);
			expect(result.text.endsWith("line 1000")).toBe(true);
			expect(result.notice).toContain("offset 1001");
		});

		it("reads from an offset", async () => {
			const result = await FileOperationService.readText({
				shell: createShell({ "/project/long.ts": file }),
				path: "/project/long.ts",
				offset: 2_990,
				limit: 5,
			});

			expect(result.text.split("\n")).toEqual([
				"line 2990",
				"line 2991",
				"line 2992",
				"line 2993",
				"line 2994",
			]);
		});

		it("cuts a single enormous line rather than returning it", async () => {
			const result = await FileOperationService.readText({
				shell: createShell({ "/project/data.json": "x".repeat(100_000) }),
				path: "/project/data.json",
			});

			expect(result.text.length).toBeLessThan(3_000);
			expect(result.text).toContain("more characters on this line");
		});

		it("returns a short file whole, with no notice", async () => {
			const result = await FileOperationService.readText({
				shell: createShell({ "/project/a.ts": "one\ntwo\n" }),
				path: "/project/a.ts",
			});

			expect(result.text).toBe("one\ntwo\n");
			expect(result.truncated).toBe(false);
			expect(result.notice).toBeUndefined();
		});
	});

	it("finds files by an approximate name", async () => {
		const shell = createShell({
			"/project/src/UserService.ts": "a",
			"/project/src/other.ts": "b",
		});

		const results = await FileOperationService.searchNames({
			shell,
			path: "/project",
			query: "usrservice",
		});

		expect(results[0].path).toBe("/project/src/UserService.ts");
	});
});
